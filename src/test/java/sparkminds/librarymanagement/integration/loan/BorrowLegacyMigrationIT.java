package sparkminds.librarymanagement.integration.loan;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import sparkminds.librarymanagement.member.repository.MemberReadRepository;
import sparkminds.librarymanagement.member.service.MemberSearchCriteria;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Chạy riêng trên MySQL test rỗng để fixture được chèn trước migration Borrow. */
@SpringBootTest(properties = "spring.liquibase.change-log=classpath:db/borrow-legacy-migration.yaml")
@ActiveProfiles("test")
class BorrowLegacyMigrationIT {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MemberReadRepository memberReadRepository;

    @Test
    void migratesLegacyDatesFeesAndHistoryWithoutInventingPaymentEvidence() {
        var rows = jdbc.queryForList("""
                SELECT li.*, l.pickup_reference FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE l.loan_code LIKE 'BORROW-LEGACY-%' ORDER BY l.loan_code
                """);
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).get("borrowed_at")).isEqualTo(LocalDateTime.of(2026, 10, 1, 8, 30));
        assertThat(rows.get(0).get("due_date").toString()).isEqualTo("2026-10-15");
        assertThat(rows.get(0).get("borrow_fee").toString()).isEqualTo("25.00");
        assertThat(rows.get(0).get("late_fee").toString()).isEqualTo("6.00");
        assertThat(rows.get(1).get("borrowed_at")).isEqualTo(LocalDateTime.of(2026, 9, 1, 9, 15));
        assertThat(rows.get(1).get("due_date").toString()).isEqualTo("2026-09-15");
        assertThat(rows.get(1).get("returned_at")).isEqualTo(LocalDateTime.of(2026, 9, 18, 10, 0));
        for (var row : rows) {
            UUID reference = UUID.fromString((String) row.get("pickup_reference"));
            assertThat(reference.version()).isEqualTo(4);
            assertThat(reference.variant()).isEqualTo(2);
            assertThat(row.get("paid_borrow_fee")).isNull();
            assertThat(row.get("borrow_fee_paid_at")).isNull();
            assertThat(row.get("late_fee_paid_at")).isNull();
        }
        assertThat(rows.get(0).get("pickup_reference")).isNotEqualTo(rows.get(1).get("pickup_reference"));
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id
                JOIN loans l ON l.id = li.loan_id WHERE l.loan_code LIKE 'BORROW-LEGACY-%'
                AND h.reason_code = 'LEGACY_IMPORTED' AND h.from_status IS NULL AND h.to_status = li.status
                AND h.actor_account_id IS NULL AND h.notification_key IS NULL
                """, Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'loans' AND column_name = 'due_date'
                """, Integer.class)).isZero();

        Integer memberId = jdbc.queryForObject("SELECT id FROM members WHERE member_code = 'BORROW-LEGACY'",
                Integer.class);
        var history = memberReadRepository.findLoanHistory(memberId,
                MemberSearchCriteria.LoanItemStatusFilter.ALL, 0, 10).content();
        assertThat(history).hasSize(2);
        assertThat(history.get(0).borrowedAt()).isEqualTo(LocalDateTime.of(2026, 10, 1, 8, 30));
        assertThat(history.get(0).dueDate()).isEqualTo(LocalDate.of(2026, 10, 15));
    }
}
