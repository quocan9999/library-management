package sparkminds.librarymanagement.database;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
class SchemaConstraintBehaviorIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void enforcesNullableUniqueIdentityAndBusinessCheckConstraints() {
        assertDoesNotThrow(() -> insertAccount("phase4-email-user", null));
        assertDoesNotThrow(() -> insertAccount("phase4-email-user-2", null));
        assertDoesNotThrow(() -> insertAccount(null, "phase4-first@example.test"));
        assertDoesNotThrow(() -> insertAccount(null, "phase4-second@example.test"));
        assertThrows(DataAccessException.class, () -> insertAccount(null, null));
        assertThrows(DataAccessException.class, () -> insertAccount("admin", "phase4-new@example.test"));
        assertThrows(DataAccessException.class, () -> insertAccount(null, "phase4-first@example.test"));

        insertMember(1, "PHASE4-MEMBER-1");
        assertThrows(DataAccessException.class, () -> insertMember(1, "PHASE4-MEMBER-2"));

        insertBook("PHASE4-BOOK-1", null, 3, 2, "1.25", "0.50");
        insertBook("PHASE4-BOOK-2", null, 1, 0, "0.00", "0.00");
        assertDoesNotThrow(() -> insertBook("PHASE4-BOOK-3", null, 1, 0, "0.00", "0.00"));
        insertBook("PHASE4-BOOK-4", "9780000000001", 1, 0, "0.00", "0.00");
        assertThrows(DataAccessException.class,
                () -> insertBook("PHASE4-BOOK-5", "9780000000001", 1, 0, "0.00", "0.00"));
        assertThrows(DataAccessException.class,
                () -> insertBook("PHASE4-BOOK-7", null, -1, 0, "0.00", "0.00"));
        assertThrows(DataAccessException.class,
                () -> insertBook("PHASE4-BOOK-8", null, 1, 2, "0.00", "0.00"));
        assertThrows(DataAccessException.class,
                () -> insertBook("PHASE4-BOOK-9", null, 1, 0, "-0.01", "0.00"));
        assertThrows(DataAccessException.class,
                () -> insertBook("PHASE4-BOOK-10", null, 1, 0, "0.00", "-0.01"));

        insertLoan("PHASE4-LOAN-1", 1, Date.valueOf(LocalDate.of(2026, 10, 6)), "ACTIVE");
        assertThrows(DataAccessException.class,
                () -> insertLoan("PHASE4-LOAN-SAME-DAY", 1, Date.valueOf(LocalDate.of(2026, 10, 5)), "ACTIVE"));
        assertThrows(DataAccessException.class,
                () -> insertLoan("PHASE4-LOAN-BAD-STATUS", 1, Date.valueOf(LocalDate.of(2026, 10, 6)), "OPEN"));

        int loanId = jdbcTemplate.queryForObject(
                "SELECT id FROM loans WHERE loan_code = 'PHASE4-LOAN-1'", Integer.class);
        int firstBookId = jdbcTemplate.queryForObject(
                "SELECT id FROM books WHERE book_code = 'PHASE4-BOOK-1'", Integer.class);
        int secondBookId = jdbcTemplate.queryForObject(
                "SELECT id FROM books WHERE book_code = 'PHASE4-BOOK-2'", Integer.class);
        insertLoanItem(loanId, firstBookId, "BORROWED", "1.25", "0.50", "0.00", null);
        assertThrows(DataAccessException.class,
                () -> insertLoanItem(loanId, firstBookId, "BORROWED", "1.25", "0.50", "0.00", null));
        assertThrows(DataAccessException.class,
                () -> insertLoanItem(loanId, secondBookId, "BORROWED", "-0.01", "0.50", "0.00", null));
        assertThrows(DataAccessException.class,
                () -> insertLoanItem(loanId, secondBookId, "BORROWED", "1.25", "-0.01", "0.00", null));
        assertThrows(DataAccessException.class,
                () -> insertLoanItem(loanId, secondBookId, "INVALID", "1.25", "0.50", "0.00", null));
        assertThrows(DataAccessException.class,
                () -> insertLoanItem(loanId, secondBookId, "BORROWED", "1.25", "0.50", "0.00", "2026-10-05 11:00:00"));
        assertThrows(DataAccessException.class,
                () -> insertLoanItem(loanId, secondBookId, "RETURNED", "1.25", "0.50", "0.00", null));
        assertThrows(DataAccessException.class,
                () -> insertLoanItem(loanId, secondBookId, "RETURNED", "1.25", "0.50", "-0.01", "2026-10-05 11:00:00"));
    }

    private void insertAccount(String username, String email) {
        jdbcTemplate.update("""
                INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled, created_at, updated_at)
                VALUES (?, ?, 'test-hash', 2, FALSE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, username, email);
    }

    private void insertMember(int accountId, String memberCode) {
        jdbcTemplate.update("""
                INSERT INTO members (account_id, member_code, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, accountId, memberCode);
    }

    private void insertBook(String bookCode, String isbn, int total, int available, String borrowFee, String lateFee) {
        jdbcTemplate.update("""
                INSERT INTO books (book_code, isbn, title, author, total_quantity, available_quantity,
                    borrow_fee, late_fee_per_day, created_at, updated_at)
                VALUES (?, ?, 'Test title', 'Test author', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, bookCode, isbn, total, available, new BigDecimal(borrowFee), new BigDecimal(lateFee));
    }

    private void insertLoan(String loanCode, int memberId, Date dueDate, String status) {
        jdbcTemplate.update("""
                INSERT INTO loans (loan_code, member_id, borrowed_at, due_date, status, created_at, updated_at)
                VALUES (?, ?, '2026-10-05 10:00:00', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, loanCode, memberId, dueDate, status);
    }

    private void insertLoanItem(
            int loanId, int bookId, String status, String borrowFee, String lateFeePerDay, String lateFee, String returnedAt) {
        jdbcTemplate.update("""
                INSERT INTO loan_items (loan_id, book_id, status, borrow_fee, late_fee_per_day, late_fee,
                    returned_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, loanId, bookId, status, new BigDecimal(borrowFee), new BigDecimal(lateFeePerDay),
                new BigDecimal(lateFee), returnedAt);
    }
}
