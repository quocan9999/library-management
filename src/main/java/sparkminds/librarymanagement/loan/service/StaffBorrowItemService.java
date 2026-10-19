package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Set;
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
            if (!previous.isPending() || item.getPaidBorrowFee() != null || item.getBorrowedAt() != null) {
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
