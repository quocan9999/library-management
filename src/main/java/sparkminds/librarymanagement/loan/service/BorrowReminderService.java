package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;
import sparkminds.librarymanagement.loan.repository.BorrowReadRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemStatusHistoryRepository;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;

@Service
@RequiredArgsConstructor
public class BorrowReminderService {
    private final BorrowReadRepository readRepository;
    private final LoanItemStatusHistoryRepository historyRepository;
    private final BorrowRetryExecutor retryExecutor;
    private final BorrowSystemItemLockService systemLocks;
    private final BorrowAuditService auditService;
    private final Clock clock;

    public int createDueReminders() {
        LocalDate today = LocalDate.now(clock);
        var ids = new ArrayList<Integer>();
        ids.addAll(readRepository.reminderCandidateIds(today.plusDays(3), NotificationKind.DUE_REMINDER_THREE_DAYS));
        ids.addAll(readRepository.reminderCandidateIds(today, NotificationKind.DUE_REMINDER_TODAY));
        ids.addAll(readRepository.reminderCandidateIds(today.minusDays(1), NotificationKind.OVERDUE_REMINDER_FIRST_DAY));
        int created = 0;
        for (Integer id : ids) if (retryExecutor.execute(() -> createOne(id))) created++;
        return created;
    }

    /** Cùng lock với renew, đọc hạn hiện hành rồi dùng key item+due+kind; audit cùng trạng thái không thay lịch mượn. */
    private boolean createOne(Integer id) {
        var found = systemLocks.lock(id);
        if (found.isEmpty() || found.get().getStatus() != LoanItemStatus.BORROWED) return false;
        var item = found.get();
        LocalDate today = LocalDate.now(clock);
        NotificationKind kind;
        if (item.getDueDate().equals(today.plusDays(3))) kind = NotificationKind.DUE_REMINDER_THREE_DAYS;
        else if (item.getDueDate().equals(today)) kind = NotificationKind.DUE_REMINDER_TODAY;
        else if (item.getDueDate().equals(today.minusDays(1))) kind = NotificationKind.OVERDUE_REMINDER_FIRST_DAY;
        else return false;
        String key = BorrowNotificationKeys.reminder(id, item.getDueDate(), kind);
        if (historyRepository.existsByNotificationKey(key)) return false;
        auditService.append(item, LoanItemStatus.BORROWED, LoanItemEventReason.valueOf(kind.name()), null, kind, key);
        return true;
    }
}
