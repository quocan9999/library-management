package sparkminds.librarymanagement.integration.loan;

import liquibase.exception.LiquibaseException;
import liquibase.integration.spring.SpringLiquibase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Chạy riêng trên DB test rỗng; kiểm tra preflight phải dừng trước khi mất cột legacy. */
@SpringBootTest(properties = "spring.liquibase.enabled=false")
@ActiveProfiles("test")
class BorrowLegacyPreflightIT {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void emptyLegacyLoanStopsMigrationBeforeAnyBorrowDdl() {
        assertThat(columnCount("loans", "due_date")).isZero();
        SpringLiquibase migration = new SpringLiquibase();
        migration.setDataSource(dataSource);
        migration.setChangeLog("classpath:db/borrow-empty-loan-migration.yaml");
        migration.setContexts("test");

        assertThatThrownBy(migration::afterPropertiesSet)
                .isInstanceOf(LiquibaseException.class)
                .hasStackTraceContaining("BORROW_LEGACY_DATA_INVALID");

        assertThat(columnCount("loans", "due_date")).isEqualTo(1);
        assertThat(columnCount("loans", "pickup_reference")).isZero();
        assertThat(jdbc.queryForObject("SELECT due_date FROM loans WHERE loan_code = 'BORROW-EMPTY'",
                String.class)).isEqualTo("2026-10-15");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM DATABASECHANGELOG WHERE id = '035-borrow-foundation'",
                Integer.class)).isZero();
    }

    private int columnCount(String table, String column) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """, Integer.class, table, column);
    }
}
