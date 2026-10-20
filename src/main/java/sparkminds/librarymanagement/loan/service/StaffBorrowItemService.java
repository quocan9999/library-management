package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanOrigin;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.List;
import java.util.HashSet;
import java.util.stream.Collectors;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class StaffBorrowItemService {
    private final BorrowRetryExecutor retryExecutor;
    private final StaffBorrowLockService locks;
    private final BorrowAuditService auditService;
    private final BorrowInventoryService inventoryService;
    private final LoanAggregateService aggregateService;
    private final StaffBorrowQueryService queryService;
    private final Clock clock;

    public StaffBorrowResponse prepare(Integer actorId, String code, Integer itemId) {
        return transition(actorId, code, itemId, LoanItemStatus.RESERVED, LoanItemStatus.PREPARING,
                LoanItemEventReason.PREPARATION_STARTED);
    }

    public StaffBorrowResponse ready(Integer actorId, String code, Integer itemId) {
        return transition(actorId, code, itemId, LoanItemStatus.PREPARING, LoanItemStatus.READY_FOR_PICKUP,
                LoanItemEventReason.READY_CONFIRMED);
    }

    /** Một lần chuẩn bị dùng chung transaction và một intent email, tránh gửi lẻ từng cuốn. */
    public StaffBorrowResponse readyBatch(Integer actorId, String code, List<Integer> itemIds) {
        if (new HashSet<>(itemIds).size() != itemIds.size()) {
            throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_REQUEST_PARAMETER", "Danh sách sách bị trùng");
        }
        return retryExecutor.execute(() -> {
            var actor = locks.actor(actorId, "borrow:prepare");
            var context = locks.lock(code, false);
            var items = itemIds.stream().sorted().map(context::item).toList();
            if (items.stream().anyMatch(item -> item.getStatus() != LoanItemStatus.RESERVED
                    && item.getStatus() != LoanItemStatus.PREPARING)) {
                throw conflict("BORROW_ITEM_NOT_READY", "Sách được chọn không còn ở trạng thái cần chuẩn bị");
            }
            LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
            String notificationKey = "ready-batch:" + items.stream().map(item -> item.getId().toString())
                    .collect(Collectors.joining(","));
            for (int index = 0; index < items.size(); index++) {
                var item = items.get(index);
                if (item.getStatus() == LoanItemStatus.RESERVED) {
                    item.setStatus(LoanItemStatus.PREPARING);
                    auditService.append(item, LoanItemStatus.RESERVED, LoanItemEventReason.PREPARATION_STARTED, actor, null, null);
                }
                item.setStatus(LoanItemStatus.READY_FOR_PICKUP);
                item.setReadyAt(now);
                item.setPickupExpiresAt(now.plusHours(72));
                auditService.append(item, LoanItemStatus.PREPARING, LoanItemEventReason.READY_CONFIRMED, actor,
                        index == 0 ? NotificationKind.READY_FOR_PICKUP : null, index == 0 ? notificationKey : null);
            }
            aggregateService.refresh(Set.of(context.loan().getId()));
            return queryService.detail(code);
        });
    }

    private StaffBorrowResponse transition(Integer actorId, String code, Integer itemId, LoanItemStatus from,
                                            LoanItemStatus to, LoanItemEventReason reason) {
        return retryExecutor.execute(() -> {
            var actor = locks.actor(actorId, "borrow:prepare");
            var context = locks.lock(code, false);
            var item = context.item(itemId);
            if (item.getStatus() != from) throw conflict("BORROW_ITEM_NOT_READY", "Trạng thái sách không cho phép thao tác chuẩn bị");
            item.setStatus(to);
            if (to == LoanItemStatus.READY_FOR_PICKUP) {
                LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
                item.setReadyAt(now);
                item.setPickupExpiresAt(now.plusHours(72));
            }
            auditService.append(item, from, reason, actor, to == LoanItemStatus.READY_FOR_PICKUP ? NotificationKind.READY_FOR_PICKUP : null,
                    to == LoanItemStatus.READY_FOR_PICKUP ? "item:" + itemId + ":ready" : null);
            aggregateService.refresh(Set.of(context.loan().getId()));
            return queryService.detail(code);
        });
    }

    /** Hủy tại quầy chỉ trước thu phí; giải phóng đúng một slot và cấp ngay cho đầu FIFO trong cùng transaction. */
    public StaffBorrowResponse cancel(Integer actorId, String code, Integer itemId) {
        return retryExecutor.execute(() -> {
            var actor = locks.actor(actorId, "borrow:cancel");
            var context = locks.lock(code, false);
            var item = context.item(itemId);
            var previous = item.getStatus();
            boolean onlineFeePaid = context.loan().getOrigin() == LoanOrigin.ONLINE
                    && context.loan().getPaymentStatus() == LoanPaymentStatus.PAID
                    && previous == LoanItemStatus.READY_FOR_PICKUP
                    && item.getPaidBorrowFee() != null
                    && item.getPaidBorrowFee().compareTo(item.getBorrowFee()) == 0;
            if (!previous.isPending() || (item.getPaidBorrowFee() != null && !onlineFeePaid)
                    || item.getBorrowedAt() != null) {
                throw conflict("BORROW_ITEM_NOT_CANCELLABLE", "Sách không còn ở trạng thái được hủy");
            }
            if (previous == LoanItemStatus.READY_FOR_PICKUP
                    && !clock.instant().isBefore(item.getPickupExpiresAt().toInstant(ZoneOffset.UTC))) {
                throw conflict("BORROW_PICKUP_EXPIRED", "Sách đã hết hạn nhận tại quầy");
            }
            item.setStatus(LoanItemStatus.CANCELLED);
            var book = item.getBook();
            if (previous != LoanItemStatus.WAITLISTED) book.setAvailableQuantity(book.getAvailableQuantity() + 1);
            auditService.append(item, previous, LoanItemEventReason.COUNTER_CANCELLED, actor,
                    NotificationKind.CANCELLED, "item:" + itemId + ":cancelled");
            var affected = new TreeSet<Integer>();
            affected.add(context.loan().getId());
            inventoryService.allocateWaiting(book, affected);
            aggregateService.refresh(affected);
            return queryService.detail(code);
        });
    }

    /** Bản vật lý không tìm thấy vẫn là unavailable; REJECTED không được tạo tồn khả dụng giả. */
    public StaffBorrowResponse reject(Integer actorId, String code, Integer itemId) {
        return retryExecutor.execute(() -> {
            var actor = locks.actor(actorId, "borrow:prepare");
            var context = locks.lock(code, false);
            var item = context.item(itemId);
            var previous = item.getStatus();
            if (previous != LoanItemStatus.RESERVED && previous != LoanItemStatus.PREPARING) {
                throw conflict("BORROW_ITEM_NOT_READY", "Chỉ từ chối sách đang giữ hoặc chuẩn bị khi không tìm thấy bản vật lý");
            }
            item.setStatus(LoanItemStatus.REJECTED);
            auditService.append(item, previous, LoanItemEventReason.PHYSICAL_COPY_UNAVAILABLE, actor, null, null);
            aggregateService.refresh(Set.of(context.loan().getId()));
            return queryService.detail(code);
        });
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
