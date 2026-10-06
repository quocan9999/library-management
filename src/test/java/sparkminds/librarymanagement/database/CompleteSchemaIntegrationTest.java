package sparkminds.librarymanagement.database;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class CompleteSchemaIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void buildsAllFourteenDomainTablesAndRecordsNineteenChangesets() {
        Set<String> expectedTables = Set.of(
                "roles", "permissions", "role_permissions", "accounts",
                "refresh_tokens", "revoked_access_tokens", "email_verification_tokens",
                "password_reset_tokens", "email_change_verifications",
                "members", "books", "loans", "loan_items", "system_configs");
        List<String> actualTables = jdbcTemplate.query("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_type = 'BASE TABLE'
                  AND table_name NOT IN ('DATABASECHANGELOG', 'DATABASECHANGELOGLOCK')
                ORDER BY table_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(expectedTables, new HashSet<>(actualTables));
        assertEquals(14, actualTables.size());

        Integer liquibaseTableCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name IN ('DATABASECHANGELOG', 'DATABASECHANGELOGLOCK')
                """, Integer.class);
        assertEquals(2, liquibaseTableCount);

        String systemConfigIdType = jdbcTemplate.queryForObject("""
                SELECT column_type
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'system_configs'
                  AND column_name = 'id'
                """, String.class);
        assertEquals("tinyint", systemConfigIdType);

        List<String> config = jdbcTemplate.query("""
                SELECT CONCAT(id, ':', maintenance_mode)
                FROM system_configs
                ORDER BY id
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(List.of("1:0"), config);

        Integer changesetCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM DATABASECHANGELOG", Integer.class);
        assertEquals(19, changesetCount);
    }
}
