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

    /** Chuẩn bị theo lô để thủ thư chuyển đồng loạt nhiều sách của một yêu cầu mà không phải gọi lẻ từng item. */
    public StaffBorrowResponse readyBatch(Integer actorId, String code, List<Integer> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) {
            throw conflict("BORROW_BATCH_EMPTY", "Phải chọn ít nhất một sách để xác nhận");
        }
        if (new HashSet<>(itemIds).size() != itemIds.size()) {
            throw conflict("BORROW_BATCH_DUPLICATE", "Danh sách sách cần chuẩn bị không được trùng lặp");
        }
        return retryExecutor.execute(() -> {
            var actor = locks.actor(actorId, "borrow:prepare");
            var context = locks.lock(code, false);
            var itemMap = context.items().stream().collect(Collectors.toMap(item -> item.getId(), item -> item));
            LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
            String notificationKey = "batch:ready:" + code + ":" + now.toEpochSecond(ZoneOffset.UTC);
            for (int index = 0; index < itemIds.size(); index++) {
                Integer id = itemIds.get(index);
                var item = itemMap.get(id);
                if (item == null) {
                    throw new BusinessException(HttpStatus.NOT_FOUND, "BORROW_ITEM_NOT_FOUND", "Không tìm thấy sách trong yêu cầu");
                }
                if (item.getStatus() != LoanItemStatus.RESERVED && item.getStatus() != LoanItemStatus.PREPARING) {
                    throw conflict("BORROW_ITEM_NOT_READY", "Trạng thái sách không cho phép thao tác chuẩn bị");
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

    /** Hủy tại quầy chỉ trước thu phí; giải phóng đúng một slot trong cùng transaction. */
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
            book.setAvailableQuantity(book.getAvailableQuantity() + 1);
            auditService.append(item, previous, LoanItemEventReason.COUNTER_CANCELLED, actor,
                    NotificationKind.CANCELLED, "item:" + itemId + ":cancelled");
            var affected = new TreeSet<Integer>();
            affected.add(context.loan().getId());
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
                throw conflict("BORROW_ITEM_NOT_REJECTABLE", "Không thể reject item ở trạng thái hiện tại");
            }
            item.setStatus(LoanItemStatus.REJECTED);
            auditService.append(item, previous, LoanItemEventReason.PHYSICAL_COPY_UNAVAILABLE, actor, null, null);
            aggregateService.refresh(Set.of(context.loan().getId()));
            return queryService.detail(code);
        });
    }

    private static BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
