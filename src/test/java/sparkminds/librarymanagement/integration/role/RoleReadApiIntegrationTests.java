package sparkminds.librarymanagement.integration.role;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import liquibase.integration.spring.SpringLiquibase;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RoleReadApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SpringLiquibase springLiquibase;

    @Test
    void testProfileUsesAnExplicitLiquibaseContextForBootstrapData() {
        assertThat(springLiquibase.getContexts()).isEqualTo("test");
    }

    @Test
    void authMeRequiresAuthenticationAndRejectsInvalidAccessTokens() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_TOKEN_INVALID"));
    }

    @Test
    void adminLoginAndMeResolveEveryPermissionFromDatabaseWithoutRolePermissionRows() throws Exception {
        Permission futurePermission = new Permission();
        futurePermission.setCode("future:catalog:read");
        permissionRepository.saveAndFlush(futurePermission);

        jdbcTemplate.update("DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.code = 'ADMIN'");

        MvcResult login = login("admin", "admin")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGIN_SUCCESS"))
                .andReturn();

        String accessToken = JsonPath.read(login.getResponse().getContentAsString(), "$.data.accessToken");
        MvcResult me = mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("admin"))
                .andExpect(jsonPath("$.data.role").value("ADMIN"))
                .andExpect(jsonPath("$.data.permissions").isArray())
                .andReturn();

        String response = me.getResponse().getContentAsString();
        List<String> permissions = JsonPath.read(response, "$.data.permissions");
        assertThat(permissions).contains("role:read", "role:update", "future:catalog:read");
        assertThat(permissions).containsExactlyElementsOf(permissions.stream().sorted().toList());
        assertThat(response).doesNotContain("passwordHash", "password_hash", "accessToken", "refreshToken", "$2a$");
        assertThat(me.getResponse().getCookie("refreshToken")).isNull();

        Account account = accountRepository.findByUsername("admin").orElseThrow();
        assertThat(account.getPasswordHash()).startsWith("$2a$12$");
        assertThat(account.isSystemAccount()).isTrue();
        assertThat(passwordEncoder.matches("admin", account.getPasswordHash())).isTrue();
    }

    @Test
    void adminRoleCatalogIsReadOnlyForAdminAndUserCannotEnterRoleManagement() throws Exception {
        Permission futurePermission = new Permission();
        futurePermission.setCode("future:catalog:read");
        permissionRepository.saveAndFlush(futurePermission);

        String adminToken = accessToken("admin", "admin");
        MvcResult rolesResponse = mockMvc.perform(get("/api/v1/roles")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andReturn();
        List<Map<String, Object>> roles = JsonPath.read(rolesResponse.getResponse().getContentAsString(), "$.data");
        assertThat(roles).extracting(role -> role.get("code")).containsExactly("ADMIN", "USER");
        assertThat(roles).filteredOn(role -> "ADMIN".equals(role.get("code")))
                .singleElement().extracting(role -> role.get("canEdit")).isEqualTo(false);
        assertThat(roles).filteredOn(role -> "USER".equals(role.get("code")))
                .singleElement().extracting(role -> role.get("canEdit")).isEqualTo(true);

        mockMvc.perform(get("/api/v1/roles/ADMIN/permissions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.editable").value(false))
                .andExpect(jsonPath("$.data.editablePermissions.length()").value(0))
                .andExpect(jsonPath("$.data.effectivePermissions[?(@ == 'future:catalog:read')]").isNotEmpty());

        MvcResult userDetails = mockMvc.perform(get("/api/v1/roles/USER/permissions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.editable").value(true))
                .andReturn();
        List<String> adminEditablePermissions = JsonPath.read(
                userDetails.getResponse().getContentAsString(), "$.data.editablePermissions");
        assertThat(adminEditablePermissions).contains("book:read", "account:change-email");
        assertThat(adminEditablePermissions).doesNotContain(
                "role:read", "role:update", "member:status:update", "config:read", "config:update",
                "future:catalog:read");

        mockMvc.perform(get("/api/v1/roles/SUPER_ADMIN/permissions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_FOUND"));

        MvcResult permissionCatalogResponse = mockMvc.perform(get("/api/v1/permissions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.code == 'future:catalog:read')]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.code == 'member:status:update')]").isNotEmpty())
                .andReturn();
        List<Map<String, Object>> permissionCatalog = JsonPath.read(
                permissionCatalogResponse.getResponse().getContentAsString(), "$.data");
        assertThat(permissionCatalog).filteredOn(permission -> "member:status:update".equals(permission.get("code")))
                .singleElement().extracting(permission -> permission.get("dependencies"))
                .isEqualTo(List.of("member:read"));
        assertThat(permissionCatalog).filteredOn(permission -> "borrow:create".equals(permission.get("code")))
                .singleElement().extracting(permission -> permission.get("dependencies"))
                .isEqualTo(List.of());

        setRolePermission("USER", "role:read", true);
        try {
            mockMvc.perform(get("/api/v1/roles")
                            .header("Authorization", "Bearer " + accessToken("user", "user")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        } finally {
            setRolePermission("USER", "role:read", false);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void adminRetainsGlobalRoleReadPermissionWhenItsAssignmentRowIsRemoved() throws Exception {
        String token = accessToken("admin", "admin");
        jdbcTemplate.update("""
                DELETE rp
                FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = ? AND p.code = ?
                """, "ADMIN", "role:read");

        try {
            mockMvc.perform(get("/api/v1/roles")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());

            MvcResult me = mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn();
            List<String> currentPermissions = JsonPath.read(
                    me.getResponse().getContentAsString(), "$.data.permissions");
            assertThat(currentPermissions).contains("role:read");
        } finally {
            jdbcTemplate.update("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    JOIN permissions p ON p.code = ?
                    WHERE r.code = ?
                      AND NOT EXISTS (
                          SELECT 1 FROM role_permissions rp
                          WHERE rp.role_id = r.id AND rp.permission_id = p.id
                      )
                    """, "role:read", "ADMIN");
        }
    }

    @Test
    void unknownRoleAndRemovedSuperAdminRoleReturnNotFound() throws Exception {
        String adminToken = accessToken("admin", "admin");
        mockMvc.perform(get("/api/v1/roles/ROLE_NOT_PRESENT/permissions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_FOUND"));
        mockMvc.perform(get("/api/v1/roles/SUPER_ADMIN/permissions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_FOUND"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void rerunningLiquibaseDoesNotRestoreManuallyChangedRolePermissionsOrDuplicateSeeds() throws Exception {
        assertThat(rolePermissionCount("ADMIN", "book:read")).isEqualTo(1);
        jdbcTemplate.update("""
                DELETE rp
                FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = ? AND p.code = ?
                """, "ADMIN", "book:read");
        assertThat(rolePermissionCount("ADMIN", "book:read")).isZero();

        try {
            springLiquibase.afterPropertiesSet();

            assertThat(rolePermissionCount("ADMIN", "book:read")).isZero();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM roles WHERE code IN ('ROLE_SUPER_ADMIN', 'SUPER_ADMIN')", Integer.class)).isZero();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM accounts WHERE username = 'superadmin'", Integer.class)).isZero();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM permissions WHERE code IN ('role:read', 'role:update')", Integer.class))
                    .isEqualTo(2);
        } finally {
            jdbcTemplate.update("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    JOIN permissions p ON p.code = ?
                    WHERE r.code = ?
                      AND NOT EXISTS (
                          SELECT 1 FROM role_permissions rp
                          WHERE rp.role_id = r.id AND rp.permission_id = p.id
                      )
                    """, "book:read", "ADMIN");
        }
    }

    private int rolePermissionCount(String roleCode, String permissionCode) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = ? AND p.code = ?
                """, Integer.class, roleCode, permissionCode);
    }

    private void setRolePermission(String roleCode, String permissionCode, boolean assigned) {
        if (assigned) {
            jdbcTemplate.update("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.code = ? AND p.code = ?
                      AND NOT EXISTS (
                          SELECT 1 FROM role_permissions existing
                          WHERE existing.role_id = r.id AND existing.permission_id = p.id
                      )
                    """, roleCode, permissionCode);
        } else {
            jdbcTemplate.update("""
                    DELETE rp
                    FROM role_permissions rp
                    JOIN roles r ON r.id = rp.role_id
                    JOIN permissions p ON p.id = rp.permission_id
                    WHERE r.code = ? AND p.code = ?
                    """, roleCode, permissionCode);
        }
    }

    private org.springframework.test.web.servlet.ResultActions login(String username, String password)
            throws Exception {
        String body = OBJECT_MAPPER.writeValueAsString(Map.of("identifier", username, "password", password));
        return mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private String accessToken(String username, String password) throws Exception {
        MvcResult result = login(username, password)
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
    }
}
