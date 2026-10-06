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
class TokenSchemaIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migratesTokenTablesWithMatchingIdsIndexesAndAccountCascades() {
        Integer tableCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name IN ('refresh_tokens', 'revoked_access_tokens',
                    'email_verification_tokens', 'password_reset_tokens', 'email_change_verifications')
                """, Integer.class);
        assertEquals(5, tableCount);

        List<String> columnTypes = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', column_name, '=', column_type)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name IN ('refresh_tokens', 'revoked_access_tokens',
                    'email_verification_tokens', 'password_reset_tokens', 'email_change_verifications')
                  AND column_name IN ('id', 'account_id')
                """, (rs, rowNum) -> rs.getString(1));
        Set<String> expectedTypes = Set.of(
                "refresh_tokens.id=int", "refresh_tokens.account_id=int",
                "revoked_access_tokens.id=int", "revoked_access_tokens.account_id=int",
                "email_verification_tokens.id=int", "email_verification_tokens.account_id=int",
                "password_reset_tokens.id=int", "password_reset_tokens.account_id=int",
                "email_change_verifications.id=int", "email_change_verifications.account_id=int");
        assertEquals(expectedTypes, new HashSet<>(columnTypes));
        assertEquals(10, columnTypes.size());

        List<String> uniqueColumns = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', column_name)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name IN ('refresh_tokens', 'revoked_access_tokens',
                    'email_verification_tokens', 'password_reset_tokens', 'email_change_verifications')
                  AND non_unique = 0
                  AND index_name <> 'PRIMARY'
                ORDER BY table_name, column_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(Set.of(
                "refresh_tokens.jti",
                "revoked_access_tokens.jti",
                "email_verification_tokens.token_hash",
                "password_reset_tokens.token_hash"), new HashSet<>(uniqueColumns));
        assertEquals(4, uniqueColumns.size());

        List<String> nullableFields = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', column_name)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND ((table_name = 'refresh_tokens' AND column_name = 'revoked_at')
                    OR (table_name IN ('email_verification_tokens', 'password_reset_tokens',
                        'email_change_verifications') AND column_name = 'used_at'))
                  AND is_nullable = 'YES'
                ORDER BY table_name, column_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(Set.of(
                "refresh_tokens.revoked_at",
                "email_verification_tokens.used_at",
                "password_reset_tokens.used_at",
                "email_change_verifications.used_at"), new HashSet<>(nullableFields));
        assertEquals(4, nullableFields.size());

        List<String> indexes = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', column_name)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name IN ('refresh_tokens', 'revoked_access_tokens',
                    'email_verification_tokens', 'password_reset_tokens', 'email_change_verifications')
                  AND non_unique = 1
                  AND index_name <> 'PRIMARY'
                GROUP BY table_name, column_name
                ORDER BY table_name, column_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(Set.of(
                "refresh_tokens.account_id", "refresh_tokens.expires_at",
                "revoked_access_tokens.account_id", "revoked_access_tokens.expires_at",
                "email_verification_tokens.account_id", "password_reset_tokens.account_id",
                "email_change_verifications.account_id"), new HashSet<>(indexes));
        assertEquals(7, indexes.size());

        List<String> deleteRules = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '=', delete_rule)
                FROM information_schema.referential_constraints
                WHERE constraint_schema = DATABASE()
                  AND table_name IN ('refresh_tokens', 'revoked_access_tokens',
                    'email_verification_tokens', 'password_reset_tokens', 'email_change_verifications')
                ORDER BY table_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(List.of(
                "email_change_verifications=CASCADE",
                "email_verification_tokens=CASCADE",
                "password_reset_tokens=CASCADE",
                "refresh_tokens=CASCADE",
                "revoked_access_tokens=CASCADE"), deleteRules);
    }
}
