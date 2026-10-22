package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.loan.entity.*;
import sparkminds.librarymanagement.loan.repository.LoanItemStatusHistoryRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class BorrowAuditService {

    private final LoanItemStatusHistoryRepository historyRepository;
    private final Clock clock;

    /** Audit và ý định email cùng transaction nghiệp vụ; chưa gửi hoặc đánh dấu SENT tại đây. */
    public void append(LoanItem item, LoanItemStatus from, LoanItemEventReason reason, Account actor,
                       NotificationKind kind, String notificationKey) {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        var event = new LoanItemStatusHistory(item, from, item.getStatus(), actor,
                actor == null ? null : actor.getRole().getCode(), reason, null, now);
        if (kind != null) {
            event.setNotificationKey(notificationKey);
            event.setNotificationKind(kind);
            event.setNotificationState(NotificationStatus.PENDING);
            event.setNotificationNextAttemptAt(now);
        }
        historyRepository.save(event);
    }
}
