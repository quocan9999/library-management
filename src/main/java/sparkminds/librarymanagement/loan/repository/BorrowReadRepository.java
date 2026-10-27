package sparkminds.librarymanagement.loan.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class BorrowReadRepository {

    private final JdbcTemplate jdbcTemplate;

    /** Loại intent đã tồn tại ngay trong DB để batch đầu không làm đói các item phía sau khi job chạy lặp. */
    public List<Integer> reminderCandidateIds(java.time.LocalDate dueDate,
                                               sparkminds.librarymanagement.loan.entity.NotificationKind kind) {
        return jdbcTemplate.queryForList("""
                SELECT li.id FROM loan_items li WHERE li.status = ? AND li.due_date = ?
                  AND NOT EXISTS (SELECT 1 FROM loan_item_status_history h
                    WHERE h.notification_key = CONCAT('item:', li.id, ':due:', ?, ':', ?))
                ORDER BY li.id LIMIT 100
                """, Integer.class, LoanItemStatus.BORROWED.name(), dueDate, dueDate.toString(), kind.name());
    }
}
