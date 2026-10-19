package sparkminds.librarymanagement.integration.loan;

import jakarta.persistence.EntityManager;
import jakarta.persistence.OptimisticLockException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.sql.SQLException;
import java.time.LocalDateTime;
import sparkminds.librarymanagement.loan.entity.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BorrowFoundationIntegrationTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManager entityManager;

    @Test
    void historyRejectsUnknownFixedValuesAndNegativeDeliveryAttempts() {
        int itemId = createReservedItem();
        jdbc.update("""
                INSERT INTO loan_item_status_history (loan_item_id, to_status, reason_code, occurred_at)
                VALUES (?, 'RESERVED', 'REQUEST_CREATED', UTC_TIMESTAMP(6))
                """, itemId);
        for (String mutation : List.of("to_status = 'INVALID'", "from_status = 'INVALID'",
                "reason_code = 'INVALID'", "notification_state = 'INVALID'", "notification_attempts = -1")) {
            assertThatThrownBy(() -> jdbc.update(
                    "UPDATE loan_item_status_history SET " + mutation + " WHERE loan_item_id = ?", itemId))
                    .as(mutation).isInstanceOf(DataAccessException.class)
                    .rootCause().isInstanceOf(SQLException.class)
                    .satisfies(error -> assertThat(((SQLException) error).getErrorCode()).isEqualTo(3819));
        }
    }

    @Test
    void jpaPersistsOpaqueReferenceVersionsAndHistoryDeliveryMetadata() {
        int itemId = createReservedItem();
        LoanItem item = entityManager.find(LoanItem.class, itemId);
        assertThat(item.getStatus()).isEqualTo(LoanItemStatus.RESERVED);
        item.setStatus(LoanItemStatus.PREPARING);
        entityManager.flush();
        assertThat(item.getVersion()).isEqualTo(1);

        Loan anotherLoan = new Loan();
        anotherLoan.setMember(item.getLoan().getMember());
        anotherLoan.setLoanCode("JPA-" + UUID.randomUUID().toString().substring(0, 8));
        anotherLoan.setStatus(LoanStatus.OPEN);
        entityManager.persist(anotherLoan);
        entityManager.flush();
        String reference = anotherLoan.getPickupReference();
        assertThat(UUID.fromString(reference).version()).isEqualTo(4);
        anotherLoan.setStatus(LoanStatus.CLOSED);
        entityManager.flush();
        assertThat(anotherLoan.getVersion()).isEqualTo(1);
        assertThat(anotherLoan.getPickupReference()).isEqualTo(reference);

        var history = new LoanItemStatusHistory(item, LoanItemStatus.RESERVED, LoanItemStatus.PREPARING,
                null, null, LoanItemEventReason.PREPARATION_STARTED, null,
                LocalDateTime.of(2026, 10, 19, 8, 30));
        entityManager.persist(history);
        entityManager.flush();
        Long historyId = history.getId();
        entityManager.clear();
        history = entityManager.find(LoanItemStatusHistory.class, historyId);
        assertThat(history.getReasonCode()).isEqualTo(LoanItemEventReason.PREPARATION_STARTED);
        assertThat(history.getFromStatus()).isEqualTo(LoanItemStatus.RESERVED);
        assertThat(history.getActorRoleCode()).isNull();
        history.setNotificationAttempts(1);
        history.setNotificationState(NotificationStatus.FAILED);
        entityManager.flush();
        assertThat(jdbc.queryForObject("SELECT notification_attempts FROM loan_item_status_history WHERE id = ?",
                Integer.class, historyId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT reason_code FROM loan_item_status_history WHERE id = ?",
                String.class, historyId)).isEqualTo("PREPARATION_STARTED");
    }

    @Test
    void staleItemVersionCannotOverwriteNewerState() {
        int itemId = createReservedItem();
        LoanItem stale = entityManager.find(LoanItem.class, itemId);
        entityManager.detach(stale);
        jdbc.update("UPDATE loan_items SET status = 'PREPARING', version = version + 1 WHERE id = ?", itemId);
        stale.setStatus(LoanItemStatus.CANCELLED);

        assertThatThrownBy(() -> {
            entityManager.merge(stale);
            entityManager.flush();
        }).isInstanceOf(OptimisticLockException.class);
    }

    @Test
    void userReceivesOwnPermissionsWhileStaffPermissionsRemainUnassigned() {
        assertThat(jdbc.queryForList("""
                SELECT p.code FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = 'USER' AND p.code IN ('borrow:read-own', 'borrow:cancel-own', 'borrow:renew')
                ORDER BY p.code
                """, String.class))
                .containsExactly("borrow:cancel-own", "borrow:read-own", "borrow:renew");
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                WHERE p.code IN ('borrow:read', 'borrow:prepare', 'borrow:cancel',
                                 'borrow:fee-confirm', 'borrow:handover')
                """, Integer.class)).isZero();
    }

    @Test
    void databaseRejectsInvalidStatusDatesRenewalAndPartialFeeConfirmation() {
        int itemId = createReservedItem();
        for (String mutation : List.of(
                "status = 'INVALID'",
                "renewal_count = 2",
                "borrow_fee = -1",
                "status = 'BORROWED'",
                "status = 'RETURNED'",
                "status = 'READY_FOR_PICKUP'",
                "paid_borrow_fee = 0",
                "borrowed_at = '2026-10-19 08:00:00', due_date = '2026-10-19'")) {
            assertThatThrownBy(() -> jdbc.update("UPDATE loan_items SET " + mutation + " WHERE id = ?", itemId))
                    .as(mutation).isInstanceOf(DataAccessException.class)
                    .rootCause().isInstanceOf(SQLException.class)
                    .satisfies(error -> assertThat(((SQLException) error).getErrorCode()).isEqualTo(3819));
        }
        assertThat(jdbc.queryForObject("SELECT status FROM loan_items WHERE id = ?", String.class, itemId))
                .isEqualTo("RESERVED");
    }

    @Test
    void pendingItemHasNoBorrowDatesAndPickupReferenceMustBeUnique() {
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
                AND table_name NOT IN ('DATABASECHANGELOG', 'DATABASECHANGELOGLOCK')
                """, Integer.class)).isEqualTo(16);
        int itemId = createReservedItem();
        assertThat(jdbc.queryForMap("SELECT borrowed_at, due_date FROM loan_items WHERE id = ?", itemId))
                .containsEntry("borrowed_at", null).containsEntry("due_date", null);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO loans (loan_code, member_id, pickup_reference, status)
                SELECT 'DUPLICATE-REF', member_id, pickup_reference, 'OPEN'
                FROM loans WHERE id = (SELECT loan_id FROM loan_items WHERE id = ?)
                """, itemId)).isInstanceOf(DataIntegrityViolationException.class);
    }

    private int createReservedItem() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                SELECT ?, ?, 'fixture-hash', id, true, true FROM roles WHERE code = 'USER'
                """, "bf" + suffix, "bf" + suffix + "@example.test");
        Integer accountId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = ?",
                Integer.class, "bf" + suffix);
        jdbc.update("INSERT INTO members (account_id, member_code, full_name) VALUES (?, ?, 'Borrow fixture')",
                accountId, "BF-" + suffix);
        Integer memberId = jdbc.queryForObject("SELECT id FROM members WHERE account_id = ?", Integer.class, accountId);
        jdbc.update("""
                INSERT INTO books (book_code, title, author, total_quantity, available_quantity, borrow_fee, late_fee_per_day)
                VALUES (?, 'Borrow fixture', 'Fixture', 1, 0, 0, 0)
                """, "BF-" + suffix);
        Integer bookId = jdbc.queryForObject("SELECT id FROM books WHERE book_code = ?", Integer.class, "BF-" + suffix);
        jdbc.update("INSERT INTO loans (loan_code, member_id, pickup_reference, status) VALUES (?, ?, ?, 'OPEN')",
                "BF-" + suffix, memberId, UUID.randomUUID().toString());
        Integer loanId = jdbc.queryForObject("SELECT id FROM loans WHERE loan_code = ?", Integer.class, "BF-" + suffix);
        jdbc.update("""
                INSERT INTO loan_items (loan_id, book_id, status, borrow_fee, late_fee_per_day)
                VALUES (?, ?, 'RESERVED', 0, 0)
                """, loanId, bookId);
        return jdbc.queryForObject("SELECT id FROM loan_items WHERE loan_id = ?", Integer.class, loanId);
    }
}
