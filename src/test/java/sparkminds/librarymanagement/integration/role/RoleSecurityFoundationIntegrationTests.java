package sparkminds.librarymanagement.integration.role;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import liquibase.integration.spring.SpringLiquibase;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@SpringBootTest
@ActiveProfiles("test")
class RoleSecurityFoundationIntegrationTests {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SpringLiquibase springLiquibase;

    @Test
    void liquibaseProvidesDynamicRoleStatusAndSystemAccountIdentity() {
        List<String> roleCodes = jdbcTemplate.queryForList(
                "SELECT code FROM roles ORDER BY code", String.class);
        assertThat(roleCodes).contains("ADMIN", "USER").doesNotContain("ROLE_SUPER_ADMIN", "SUPER_ADMIN");

        assertThat(jdbcTemplate.queryForObject(
                "SELECT display_name FROM roles WHERE code = 'ADMIN'", String.class))
                .isEqualTo("Quản trị viên");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT enabled FROM roles WHERE code = 'USER'", Boolean.class)).isTrue();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT is_system_account FROM accounts WHERE username = 'admin'", Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts WHERE is_system_account = TRUE", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts WHERE username = 'superadmin'", Integer.class)).isZero();

        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'roles' AND column_name = 'display_name'
                  AND character_maximum_length = 100 AND is_nullable = 'NO'
                """, Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'roles' AND column_name = 'enabled'
                  AND is_nullable = 'NO' AND column_default = '1'
                """, Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'accounts' AND column_name = 'is_system_account'
                  AND is_nullable = 'NO' AND column_default = '0'
                """, Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = 'roles' AND column_name = 'code'
                  AND non_unique = 0
                """, Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.key_column_usage
                WHERE table_schema = DATABASE() AND table_name = 'accounts' AND column_name = 'role_id'
                  AND referenced_table_name = 'roles' AND referenced_column_name = 'id'
                """, Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM DATABASECHANGELOG WHERE ID = '030-dynamic-role-account-foundation'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void liquibaseRestartDoesNotRerunOrDuplicateFoundationChangeset() {
        assertThatCode(() -> springLiquibase.afterPropertiesSet()).doesNotThrowAnyException();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM DATABASECHANGELOG WHERE ID = '030-dynamic-role-account-foundation'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM roles WHERE code IN ('ADMIN', 'USER')", Integer.class)).isEqualTo(2);
    }
}
