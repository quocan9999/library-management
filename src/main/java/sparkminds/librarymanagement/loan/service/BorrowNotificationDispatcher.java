package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
@Slf4j
public class BorrowNotificationDispatcher {
    private final BorrowNotificationRepository repository;
    private final BorrowNotificationDeliveryService deliveryService;
    private final Clock clock;

    /** Claim commit trước; lần gửi có transaction riêng để renew không vượt qua reminder đang gửi và DB giữ retry sau restart. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public int dispatchPending() {
        int sent = 0;
        for (Long id : repository.dueIds(now())) {
            var claimed = repository.claim(id, now());
            if (claimed.isEmpty()) continue;
            var delivery = claimed.get();
            try {
                if (deliveryService.deliver(delivery)) sent++;
            } catch (RuntimeException exception) {
                LocalDateTime next = delivery.attempt() >= BorrowNotificationRepository.MAX_ATTEMPTS ? null
                        : now().plusSeconds(Math.min(3600L, 60L << (delivery.attempt() - 1)));
                repository.failed(delivery, next, "SMTP_DELIVERY_FAILED");
                log.warn("Không gửi được thông báo mượn sách; loại={}, lần thử={}", delivery.kind(), delivery.attempt());
            }
        }
        return sent;
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
