package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class BorrowExpirationService {
    private final LoanItemRepository itemRepository;
    private final BorrowRetryExecutor retryExecutor;
    private final BorrowSystemItemLockService systemLocks;
    private final BorrowInventoryService inventoryService;
    private final LoanAggregateService aggregateService;
    private final BorrowAuditService auditService;
    private final Clock clock;

    /** Scan timestamp đã quá hạn nên khởi động lại vẫn bắt kịp; mỗi item commit riêng, gọi lặp không hoàn tồn hai lần. */
    public int expirePending() {
        var now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        var ids = itemRepository.findExpiredPickupIds(LoanItemStatus.READY_FOR_PICKUP, now, PageRequest.of(0, 100));
        int expired = 0;
        for (Integer id : ids) if (retryExecutor.execute(() -> expireOne(id))) expired++;
        return expired;
    }

    private boolean expireOne(Integer id) {
        var found = systemLocks.lock(id);
        if (found.isEmpty()) return false;
        var item = found.get();
        if (item.getStatus() != LoanItemStatus.READY_FOR_PICKUP
                || clock.instant().isBefore(item.getPickupExpiresAt().toInstant(ZoneOffset.UTC))) return false;
        item.setStatus(LoanItemStatus.EXPIRED);
        var book = item.getBook();
        book.setAvailableQuantity(book.getAvailableQuantity() + 1);
        auditService.append(item, LoanItemStatus.READY_FOR_PICKUP, LoanItemEventReason.PICKUP_EXPIRED, null,
                NotificationKind.EXPIRED, "item:" + id + ":expired");
        var affected = new TreeSet<Integer>();
        affected.add(item.getLoan().getId());
        inventoryService.allocateWaiting(book, affected);
        aggregateService.refresh(affected);
        return true;
    }
}
