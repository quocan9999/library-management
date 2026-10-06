package sparkminds.librarymanagement.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class AuthSchemaIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migratesAuthTablesWithFinalTypesConstraintsAndSeeds() {
        Integer authTableCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name IN ('roles', 'permissions', 'role_permissions', 'accounts')
                """, Integer.class);
        assertEquals(4, authTableCount);

        List<String> columnTypes = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', column_name, '=', column_type)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND ((table_name = 'roles' AND column_name = 'id')
                    OR (table_name = 'permissions' AND column_name = 'id')
                    OR (table_name = 'role_permissions' AND column_name IN ('role_id', 'permission_id'))
                    OR (table_name = 'accounts' AND column_name IN ('id', 'role_id')))
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(Set.of(
                "roles.id=smallint",
                "permissions.id=smallint",
                "role_permissions.role_id=smallint",
                "role_permissions.permission_id=smallint",
                "accounts.id=int",
                "accounts.role_id=smallint"), new HashSet<>(columnTypes));
        assertEquals(6, columnTypes.size());

        Integer accountUniqueCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.table_constraints
                WHERE constraint_schema = DATABASE()
                  AND table_name = 'accounts'
                  AND constraint_type = 'UNIQUE'
                """, Integer.class);
        assertEquals(2, accountUniqueCount);

        Integer accountCheckCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.table_constraints
                WHERE constraint_schema = DATABASE()
                  AND table_name = 'accounts'
                  AND constraint_type = 'CHECK'
                """, Integer.class);
        assertEquals(1, accountCheckCount);

        List<String> deleteRules = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '=', delete_rule)
                FROM information_schema.referential_constraints
                WHERE constraint_schema = DATABASE()
                  AND table_name IN ('role_permissions', 'accounts')
                ORDER BY table_name, constraint_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(List.of("accounts=RESTRICT", "role_permissions=RESTRICT", "role_permissions=RESTRICT"), deleteRules);

        Integer roleCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM roles WHERE code IN ('ROLE_ADMIN', 'ROLE_USER')
                """, Integer.class);
        assertEquals(2, roleCount);
        Integer permissionCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM permissions", Integer.class);
        assertEquals(15, permissionCount);
        Integer rolePermissionCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM role_permissions", Integer.class);
        assertEquals(16, rolePermissionCount);

        Set<String> expectedMatrix = Set.of(
                "ROLE_ADMIN:book:read", "ROLE_ADMIN:book:create", "ROLE_ADMIN:book:update",
                "ROLE_ADMIN:book:delete", "ROLE_ADMIN:book:import", "ROLE_ADMIN:member:read",
                "ROLE_ADMIN:member:create", "ROLE_ADMIN:member:update", "ROLE_ADMIN:member:delete",
                "ROLE_ADMIN:config:read", "ROLE_ADMIN:config:update", "ROLE_USER:book:read",
                "ROLE_USER:borrow:create", "ROLE_USER:borrow:return",
                "ROLE_USER:account:change-password", "ROLE_USER:account:change-email");
        List<String> actualMatrix = jdbcTemplate.query("""
                SELECT CONCAT(r.code, ':', p.code)
                FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                ORDER BY r.code, p.code
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(expectedMatrix, new HashSet<>(actualMatrix));

        Map<String, Object> admin = jdbcTemplate.queryForMap("""
                SELECT password_hash, email_verified, enabled
                FROM accounts
                WHERE username = 'admin'
                """);
        assertEquals(1, ((Number) admin.get("email_verified")).intValue());
        assertEquals(1, ((Number) admin.get("enabled")).intValue());
        assertTrue(admin.get("password_hash").toString().matches("^\\$2[aby]\\$[0-9]{2}\\$.{53}$"));
    }
}
