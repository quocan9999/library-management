package sparkminds.librarymanagement.loan.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;
import sparkminds.librarymanagement.loan.entity.NotificationStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class BorrowNotificationRepository {
    public static final int MAX_ATTEMPTS = 5;
    private final JdbcTemplate jdbc;

    public List<Long> dueIds(LocalDateTime now) {
        // Worker có thể chết ở lần claim cuối; khi lease hết, hiển thị FAILED thay vì để PENDING vĩnh viễn.
        jdbc.update("""
                UPDATE loan_item_status_history SET notification_state = ?, notification_next_attempt_at = NULL,
                  notification_last_error_code = 'DELIVERY_ATTEMPTS_EXHAUSTED'
                WHERE notification_state = ? AND notification_attempts >= ? AND notification_next_attempt_at <= ?
                """, NotificationStatus.FAILED.name(), NotificationStatus.PENDING.name(), MAX_ATTEMPTS, now);
        return jdbc.queryForList("""
                SELECT id FROM loan_item_status_history WHERE notification_state IN (?, ?)
                  AND notification_next_attempt_at <= ? AND notification_attempts < ?
                ORDER BY notification_next_attempt_at, id LIMIT 100
                """, Long.class, NotificationStatus.PENDING.name(), NotificationStatus.FAILED.name(), now, MAX_ATTEMPTS);
    }

    /** Lease được commit trước SMTP; attempts là thế hệ claim để worker cũ không ghi đè kết quả worker mới sau restart. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<Delivery> claim(Long id, LocalDateTime now) {
        int updated = jdbc.update("""
                UPDATE loan_item_status_history SET notification_state = ?, notification_attempts = notification_attempts + 1,
                  notification_next_attempt_at = ?
                WHERE id = ? AND notification_state IN (?, ?) AND notification_next_attempt_at <= ? AND notification_attempts < ?
                """, NotificationStatus.PENDING.name(), now.plusMinutes(5), id, NotificationStatus.PENDING.name(),
                NotificationStatus.FAILED.name(), now, MAX_ATTEMPTS);
        if (updated == 0) return Optional.empty();
        return jdbc.query("""
                SELECT h.id, h.notification_attempts, h.notification_kind, h.notification_key,
                  li.id AS item_id, li.book_id, li.status, li.due_date, li.pickup_expires_at,
                  a.email, l.loan_code, b.title
                FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id
                JOIN loans l ON l.id = li.loan_id JOIN members m ON m.id = l.member_id
                JOIN accounts a ON a.id = m.account_id JOIN books b ON b.id = li.book_id WHERE h.id = ?
                """, (rs, row) -> new Delivery(rs.getLong("id"), rs.getInt("notification_attempts"),
                NotificationKind.valueOf(rs.getString("notification_kind")), rs.getString("notification_key"),
                rs.getInt("item_id"), rs.getInt("book_id"), LoanItemStatus.valueOf(rs.getString("status")),
                rs.getObject("due_date", LocalDate.class), rs.getObject("pickup_expires_at", LocalDateTime.class),
                rs.getString("email"), rs.getString("loan_code"), rs.getString("title")), id).stream().findFirst();
    }

    /** Khóa bản ghi intent để worker hết lease hoặc renew không đổi thế hệ claim trong lúc gửi. */
    public boolean lockCurrentClaim(Delivery delivery, LocalDateTime now) {
        var claims = jdbc.query("""
                SELECT notification_state, notification_attempts, notification_next_attempt_at
                FROM loan_item_status_history WHERE id = ? FOR UPDATE
                """, (rs, row) -> new Claim(rs.getString("notification_state"), rs.getInt("notification_attempts"),
                rs.getObject("notification_next_attempt_at", LocalDateTime.class)), delivery.id());
        return claims.size() == 1 && NotificationStatus.PENDING.name().equals(claims.get(0).state())
                && claims.get(0).attempt() == delivery.attempt()
                && claims.get(0).leaseUntil() != null && claims.get(0).leaseUntil().isAfter(now);
    }

    /** Bản ghi đang bị khóa bởi delivery transaction; lỗi này không được làm sống lại lease cũ. */
    public void supersedeClaim(Delivery delivery) {
        jdbc.update("""
                UPDATE loan_item_status_history SET notification_state = ?, notification_next_attempt_at = NULL,
                  notification_last_error_code = 'REMINDER_SUPERSEDED'
                WHERE id = ? AND notification_attempts = ? AND notification_state = ?
                """, NotificationStatus.FAILED.name(), delivery.id(), delivery.attempt(), NotificationStatus.PENDING.name());
    }

    @Transactional
    public void sent(Delivery delivery, LocalDateTime now) {
        jdbc.update("""
                UPDATE loan_item_status_history SET notification_state = ?, notification_sent_at = ?,
                  notification_next_attempt_at = NULL, notification_last_error_code = NULL
                WHERE id = ? AND notification_attempts = ? AND notification_state = ?
                """, NotificationStatus.SENT.name(), now, delivery.id(), delivery.attempt(), NotificationStatus.PENDING.name());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failed(Delivery delivery, LocalDateTime nextAttempt, String safeCode) {
        jdbc.update("""
                UPDATE loan_item_status_history SET notification_state = ?, notification_next_attempt_at = ?,
                  notification_last_error_code = ? WHERE id = ? AND notification_attempts = ? AND notification_state = ?
                """, NotificationStatus.FAILED.name(), nextAttempt, safeCode, delivery.id(), delivery.attempt(), NotificationStatus.PENDING.name());
    }

    /** Chỉ sửa delivery metadata trong transaction renew; không sửa reason/status/time của audit đã ghi. */
    public void supersedeOldReminders(Integer itemId, LocalDate currentDueDate) {
        jdbc.update("""
                UPDATE loan_item_status_history SET notification_state = ?, notification_next_attempt_at = NULL,
                  notification_last_error_code = 'REMINDER_SUPERSEDED'
                WHERE loan_item_id = ? AND notification_kind IN (?, ?, ?) AND notification_state <> ?
                  AND notification_key NOT LIKE CONCAT('item:', ?, ':due:', ?, ':%')
                """, NotificationStatus.FAILED.name(), itemId, NotificationKind.DUE_REMINDER_THREE_DAYS.name(),
                NotificationKind.DUE_REMINDER_TODAY.name(), NotificationKind.OVERDUE_REMINDER_FIRST_DAY.name(),
                NotificationStatus.SENT.name(), itemId, currentDueDate.toString());
    }

    /** Key chỉ chứa ID nội bộ; giới hạn theo cùng Loan để nội dung không lẫn yêu cầu khác. */
    public List<String> readyBatchTitles(Delivery delivery) {
        return jdbc.queryForList("""
                SELECT b.title FROM loan_items li JOIN books b ON b.id = li.book_id
                JOIN loans l ON l.id = li.loan_id
                WHERE l.loan_code = ? AND FIND_IN_SET(CAST(li.id AS CHAR), ?) > 0 ORDER BY li.id
                """, String.class, delivery.loanCode(), delivery.key().substring("ready-batch:".length()));
    }

    /** DTO nội bộ cho SMTP; không serialize recipient hoặc nội dung này lên API/log. */
    public record Delivery(Long id, int attempt, NotificationKind kind, String key, Integer itemId, Integer bookId,
                            LoanItemStatus itemStatus, LocalDate dueDate, LocalDateTime pickupExpiresAt,
                            String email, String loanCode, String bookTitle) {
        public boolean isReminder() {
            return kind == NotificationKind.DUE_REMINDER_THREE_DAYS || kind == NotificationKind.DUE_REMINDER_TODAY
                    || kind == NotificationKind.OVERDUE_REMINDER_FIRST_DAY;
        }
    }

    private record Claim(String state, int attempt, LocalDateTime leaseUntil) {
    }
}
