package sparkminds.librarymanagement.loan.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

    /** Tính n/N trong một query có index FIFO, không cache vị trí hoặc truy vấn riêng mỗi item trong trang. */
    public Map<Integer, QueuePosition> queuePositions(List<Integer> ids) {
        if (ids.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(LoanItemStatus.WAITLISTED.name());
        arguments.add(LoanItemStatus.WAITLISTED.name());
        arguments.add(LoanItemStatus.WAITLISTED.name());
        arguments.addAll(ids);
        var positions = jdbcTemplate.query("""
                SELECT current_item.id,
                  (SELECT COUNT(*) FROM loan_items ahead
                   WHERE ahead.book_id = current_item.book_id AND ahead.status = ?
                     AND (ahead.waitlisted_at < current_item.waitlisted_at OR
                          (ahead.waitlisted_at = current_item.waitlisted_at AND ahead.id <= current_item.id))) AS position,
                  (SELECT COUNT(*) FROM loan_items waiting
                   WHERE waiting.book_id = current_item.book_id AND waiting.status = ?) AS total
                FROM loan_items current_item WHERE current_item.status = ? AND current_item.id IN (
                """ + placeholders + ")", (rs, row) -> new QueuePosition(rs.getInt("id"), rs.getLong("position"),
                rs.getLong("total")), arguments.toArray());
        return positions.stream().collect(Collectors.toMap(QueuePosition::itemId, value -> value));
    }

    public record QueuePosition(Integer itemId, long position, long total) {
    }
}
