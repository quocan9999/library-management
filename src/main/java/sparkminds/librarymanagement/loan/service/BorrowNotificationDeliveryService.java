package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository.Delivery;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class BorrowNotificationDeliveryService {
    private final BorrowSystemItemLockService systemLocks;
    private final BorrowNotificationRepository repository;
    private final BorrowNotificationMailSender sender;
    private final Clock clock;

    /** Giữ thứ tự khóa với renew đến khi SMTP xong để reminder cũ không vượt qua lần gia hạn vừa commit. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean deliver(Delivery delivery) {
        var found = systemLocks.lock(delivery.itemId());
        if (found.isEmpty()) return false;
        var item = found.get();
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (!repository.lockCurrentClaim(delivery, now)) return false;
        if (delivery.isReminder() && (!delivery.key().equals(BorrowNotificationKeys.reminder(
                item.getId(), item.getDueDate(), delivery.kind())) || item.getStatus() != LoanItemStatus.BORROWED)) {
            repository.supersedeClaim(delivery);
            return false;
        }

        // Nghiệp vụ đã commit trước đó; transaction này chỉ giữ khóa ngắn hạn và ghi kết quả delivery.
        sender.send(delivery);
        repository.sent(delivery, LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
        return true;
    }
}
