package sparkminds.librarymanagement.integration.role;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RoleManagementApiIntegrationTests {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void adminCanSearchRolesWithUnicodePaginationAndAccurateCounts() throws Exception {
        String token = accessToken("admin", "admin");

        MvcResult list = mockMvc.perform(get("/api/v1/roles")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn();
        List<Map<String, Object>> roleSummaries = JsonPath.read(list.getResponse().getContentAsString(), "$.data");
        assertThat(roleSummaries).hasSize(2);
        assertThat(roleSummaries).filteredOn(role -> "ADMIN".equals(role.get("code")))
                .singleElement().satisfies(role -> {
                    assertThat(role.get("displayName")).isEqualTo("Quản trị viên");
                    assertThat(role.get("enabled")).isEqualTo(true);
                });
        assertThat(roleSummaries).filteredOn(role -> "USER".equals(role.get("code")))
                .singleElement().satisfies(role -> assertThat(role.get("enabled")).isEqualTo(true));

        MvcResult search = mockMvc.perform(get("/api/v1/roles/search")
                        .param("q", "Người dùng")
                        .param("status", "ACTIVE")
                        .param("page", "0")
                        .param("size", "1")
                        .param("sort", "displayName")
                        .param("direction", "DESC")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].code").value("USER"))
                .andExpect(jsonPath("$.data.content[0].displayName").value("Người dùng"))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.content[0].accountCount").value(1))
                .andReturn();
        int catalogSize = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM permissions", Integer.class);
        assertThat(JsonPath.<Integer>read(search.getResponse().getContentAsString(),
                "$.data.content[0].permissionCount")).isEqualTo(permissionCount("USER"));

        mockMvc.perform(get("/api/v1/roles/search")
                        .param("status", "UNKNOWN")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ROLE_SEARCH_INVALID"));
        mockMvc.perform(get("/api/v1/roles/search")
                        .param("size", "101")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ROLE_SEARCH_INVALID"));
        mockMvc.perform(get("/api/v1/roles/search")
                        .param("page", "2147483647")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ROLE_SEARCH_INVALID"));
        mockMvc.perform(get("/api/v1/roles/search")
                        .param("sort", "code; delete from roles")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ROLE_SEARCH_INVALID"));

        MvcResult adminDetail = mockMvc.perform(get("/api/v1/roles/ADMIN")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.systemRole").value(true))
                .andExpect(jsonPath("$.data.readOnly").value(true))
                .andExpect(jsonPath("$.data.permissionCount").value(catalogSize))
                .andReturn();
        assertThat(JsonPath.<Integer>read(adminDetail.getResponse().getContentAsString(),
                "$.data.accountCount")).isEqualTo(1);
    }

    @Test
    void adminCreatesGroupWithRequiredDependenciesAndCanReadDetailAndCatalog() throws Exception {
        String token = accessToken("admin", "admin");

        MvcResult created = mockMvc.perform(post("/api/v1/roles")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("LIBRARIAN", "Thủ thư", "Quản lý sách", List.of("book:create"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("ROLE_CREATED"))
                .andExpect(jsonPath("$.data.code").value("LIBRARIAN"))
                .andExpect(jsonPath("$.data.displayName").value("Thủ thư"))
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.systemRole").value(false))
                .andExpect(jsonPath("$.data.readOnly").value(false))
                .andExpect(jsonPath("$.data.accountCount").value(0))
                .andExpect(jsonPath("$.data.permissionCount").value(2))
                .andReturn();
        assertThat(created.getResponse().getHeader("Location")).endsWith("/api/v1/roles/LIBRARIAN");
        assertThat(permissionCodes("LIBRARIAN")).containsExactly("book:create", "book:read");

        mockMvc.perform(get("/api/v1/roles/LIBRARIAN")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").value("Quản lý sách"))
                .andExpect(jsonPath("$.data.version").value(0));
        MvcResult rolePermissions = mockMvc.perform(get("/api/v1/roles/LIBRARIAN/permissions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.editable").value(true))
                .andReturn();
        assertThat(JsonPath.<List<String>>read(rolePermissions.getResponse().getContentAsString(),
                "$.data.assignedPermissions")).containsExactly("book:create", "book:read");
        assertThat(JsonPath.<List<String>>read(rolePermissions.getResponse().getContentAsString(),
                "$.data.effectivePermissions")).containsExactly("book:create", "book:read");
        assertThat(JsonPath.<List<String>>read(rolePermissions.getResponse().getContentAsString(),
                "$.data.editablePermissions")).isNotEmpty();

        MvcResult catalog = mockMvc.perform(get("/api/v1/permissions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn();
        List<Map<String, Object>> catalogItems = JsonPath.read(catalog.getResponse().getContentAsString(), "$.data");
        assertThat(catalogItems).filteredOn(permission -> "role:read".equals(permission.get("code")))
                .singleElement().satisfies(permission -> assertThat(permission.get("manageableByActor")).isEqualTo(false));
        assertThat(catalogItems).filteredOn(permission -> "book:create".equals(permission.get("code")))
                .singleElement().satisfies(permission -> {
                    assertThat(permission.get("domain")).isEqualTo("book");
                    assertThat(permission.get("manageableByActor")).isEqualTo(true);
                });
    }

    @Test
    void groupCreationRejectsDuplicateMalformedReservedUnknownAndForbiddenInputs() throws Exception {
        String token = accessToken("admin", "admin");
        createRole(token, "LIBRARIAN", "Thủ thư", List.of("book:read"));

        mockMvc.perform(post("/api/v1/roles").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("LIBRARIAN", "Duplicate", null, List.of("book:read"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROLE_CODE_DUPLICATED"));
        assertCreateRejected(token, "bad-code", "Sai mã", List.of("book:read"), 422, "VALIDATION_ERROR");
        assertCreateRejected(token, "ROLE_LIBRARIAN", "Có prefix", List.of("book:read"),
                400, "ROLE_CODE_INVALID");
        assertCreateRejected(token, "SUPER_ADMIN", "Mã cũ", List.of("book:read"),
                400, "ROLE_CODE_RESERVED");
        assertCreateRejected(token, "EMPTY_GROUP", "Không quyền", List.of(), 422, "VALIDATION_ERROR");
        assertCreateRejected(token, "UNKNOWN_PERMISSION", "Quyền lạ", List.of("future:missing"),
                400, "ROLE_PERMISSION_UNKNOWN");
        assertCreateRejected(token, "GROUP_GRANT", "Quyền quản trị", List.of("role:read"),
                403, "PERMISSION_DENIED");
        mockMvc.perform(post("/api/v1/roles")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"NO_NAME\",\"permissions\":[\"book:read\"]}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void adminCanUpdateUserAndCustomMetadataAndStatusButNeverSystemRoleState() throws Exception {
        String token = accessToken("admin", "admin");
        createRole(token, "LIBRARIAN", "Thủ thư", List.of("book:read"));

        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(metadataBody(0, "Trưởng thủ thư", "Đã cập nhật mô tả")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("ROLE_UPDATED"))
                .andExpect(jsonPath("$.data.displayName").value("Trưởng thủ thư"))
                .andExpect(jsonPath("$.data.version").value(1));
        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(metadataBody(0, "Stale", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROLE_VERSION_CONFLICT"));

        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN/status")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false))
                .andExpect(jsonPath("$.data.version").value(2));
        assertThat(permissionCodes("LIBRARIAN")).containsExactly("book:read");
        MvcResult inactivePermissions = mockMvc.perform(get("/api/v1/roles/LIBRARIAN/permissions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.editable").value(false))
                .andReturn();
        assertThat(JsonPath.<List<String>>read(inactivePermissions.getResponse().getContentAsString(),
                "$.data.assignedPermissions")).containsExactly("book:read");
        assertThat(JsonPath.<List<String>>read(inactivePermissions.getResponse().getContentAsString(),
                "$.data.effectivePermissions")).isEmpty();
        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(metadataBody(2, "Không được sửa", "Inactive")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROLE_INACTIVE"));
        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN/permissions")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(permissionDelta(2, List.of("book:create"), List.of())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROLE_INACTIVE"));
        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN/status")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":2,\"enabled\":false}"))
                .andExpect(status().isConflict());
        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN/status")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":2,\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.version").value(3));

        mockMvc.perform(patch("/api/v1/roles/USER")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(metadataBody(0, "Bạn đọc", "Vai trò cơ sở")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(1));
        mockMvc.perform(patch("/api/v1/roles/USER/status")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"enabled\":false}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ROLE_SYSTEM_IMMUTABLE"));
        mockMvc.perform(patch("/api/v1/roles/ADMIN")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(metadataBody(0, "Renamed", "Blocked")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ROLE_SYSTEM_IMMUTABLE"));
        mockMvc.perform(patch("/api/v1/roles/ADMIN/status")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":0,\"enabled\":false}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ROLE_SYSTEM_IMMUTABLE"));
        mockMvc.perform(patch("/api/v1/roles/ADMIN/permissions")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(permissionDelta(0, List.of("book:create"), List.of())))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/v1/roles/USER/permissions")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(permissionDelta(1, List.of(), permissionCodes("USER"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ROLE_PERMISSION_EMPTY"));
    }

    @Test
    void inactiveGroupWithAssignedAccountLosesBusinessRightsWithoutLosingLinksOrSessions() throws Exception {
        String adminToken = accessToken("admin", "admin");
        createRole(adminToken, "LIBRARIAN", "Thủ thư", List.of("member:read"));
        String username = createAccountInRole("LIBRARIAN");
        String memberToken = accessToken(username, "Librarian1!");
        long version = roleVersion("LIBRARIAN");

        mockMvc.perform(get("/api/v1/members").header("Authorization", bearer(memberToken)))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN/status")
                        .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":0,\"enabled\":false}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(memberToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("LIBRARIAN"))
                .andExpect(jsonPath("$.data.permissions").isEmpty());
        mockMvc.perform(get("/api/v1/members").header("Authorization", bearer(memberToken)))
                .andExpect(status().isForbidden());
        assertThat(roleVersion("LIBRARIAN")).isEqualTo(version + 1);
        assertThat(permissionCodes("LIBRARIAN")).containsExactly("member:read");

        mockMvc.perform(patch("/api/v1/roles/LIBRARIAN/status")
                        .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"enabled\":true}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/members").header("Authorization", bearer(memberToken)))
                .andExpect(status().isOk());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void customRolePermissionAndStatusRaceSerializesOnVersionAndPreservesAssignments() throws Exception {
        String token = accessToken("admin", "admin");
        createRole(token, "RACE_GROUP", "Race group", List.of("book:read"));
        long expectedVersion = roleVersion("RACE_GROUP");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        Callable<MvcResult> permissionUpdate = () -> {
            ready.countDown();
            if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new IllegalStateException("Permission race did not start");
            }
            return mockMvc.perform(patch("/api/v1/roles/RACE_GROUP/permissions")
                            .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                            .content(permissionDelta(expectedVersion, List.of("book:import"), List.of())))
                    .andReturn();
        };
        Callable<MvcResult> statusUpdate = () -> {
            ready.countDown();
            if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new IllegalStateException("Status race did not start");
            }
            return mockMvc.perform(patch("/api/v1/roles/RACE_GROUP/status")
                            .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"expectedVersion\":" + expectedVersion + ",\"enabled\":false}"))
                    .andReturn();
        };
        Future<MvcResult> permissions = executor.submit(permissionUpdate);
        Future<MvcResult> status = executor.submit(statusUpdate);
        try {
            assertThat(ready.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<Integer> responses = List.of(
                    permissions.get(30, java.util.concurrent.TimeUnit.SECONDS).getResponse().getStatus(),
                    status.get(30, java.util.concurrent.TimeUnit.SECONDS).getResponse().getStatus());
            assertThat(responses).contains(200);
            assertThat(responses).containsAnyOf(409, 403);
            assertThat(roleVersion("RACE_GROUP")).isEqualTo(expectedVersion + 1);
            boolean enabled = jdbcTemplate.queryForObject(
                    "SELECT enabled FROM roles WHERE code = 'RACE_GROUP'", Boolean.class);
            if (enabled) {
                assertThat(permissionCodes("RACE_GROUP")).contains("book:import", "book:read");
            } else {
                assertThat(permissionCodes("RACE_GROUP")).containsExactly("book:read");
            }
        } finally {
            start.countDown();
            executor.shutdownNow();
            deleteRoleFixture("RACE_GROUP");
        }
    }

    @Test
    void roleManagementRequiresAdminEvenWhenUserHasRolePermissions() throws Exception {
        setRolePermission("USER", "role:read", true);
        setRolePermission("USER", "role:update", true);
        try {
            String token = accessToken("user", "user");
            mockMvc.perform(get("/api/v1/roles/search").header("Authorization", bearer(token)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/v1/roles")
                            .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                            .content(createBody("LIBRARIAN", "Thủ thư", null, List.of("book:read"))))
                    .andExpect(status().isForbidden());
        } finally {
            setRolePermission("USER", "role:read", false);
            setRolePermission("USER", "role:update", false);
        }
    }

    private void assertCreateRejected(String token, String code, String displayName, List<String> permissions,
                                      int expectedStatus, String expectedCode) throws Exception {
        mockMvc.perform(post("/api/v1/roles").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(code, displayName, null, permissions)))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.code").value(expectedCode));
    }

    private void createRole(String token, String code, String displayName, List<String> permissions) throws Exception {
        mockMvc.perform(post("/api/v1/roles").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(code, displayName, null, permissions)))
                .andExpect(status().isCreated());
    }

    private String createAccountInRole(String roleCode) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String username = "dyn" + suffix;
        jdbcTemplate.update("""
                INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                SELECT ?, ?, ?, id, true, true FROM roles WHERE code = ?
                """, username, username + "@example.test", passwordEncoder.encode("Librarian1!"), roleCode);
        return username;
    }

    private List<String> permissionCodes(String roleCode) {
        return jdbcTemplate.queryForList("""
                SELECT p.code FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = ? ORDER BY p.code
                """, String.class, roleCode);
    }

    private int permissionCount(String roleCode) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.code = ?
                """, Integer.class, roleCode);
    }

    private long roleVersion(String roleCode) {
        return jdbcTemplate.queryForObject("SELECT version FROM roles WHERE code = ?", Long.class, roleCode);
    }

    private void setRolePermission(String roleCode, String permissionCode, boolean assigned) {
        if (assigned) {
            jdbcTemplate.update("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
                    WHERE r.code = ? AND p.code = ? AND NOT EXISTS (
                        SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id)
                    """, roleCode, permissionCode);
        } else {
            jdbcTemplate.update("""
                    DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
                    JOIN permissions p ON p.id = rp.permission_id WHERE r.code = ? AND p.code = ?
                    """, roleCode, permissionCode);
        }
    }

    private void deleteRoleFixture(String roleCode) {
        Integer roleId = jdbcTemplate.queryForObject("SELECT id FROM roles WHERE code = ?", Integer.class, roleCode);
        jdbcTemplate.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
        jdbcTemplate.update("DELETE FROM roles WHERE id = ?", roleId);
    }

    private String accessToken(String identifier, String password) throws Exception {
        String body = OBJECT_MAPPER.writeValueAsString(Map.of("identifier", identifier, "password", password));
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
    }

    private static String createBody(String code, String displayName, String description, List<String> permissions)
            throws Exception {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("code", code);
        if (displayName != null) body.put("displayName", displayName);
        body.put("description", description);
        body.put("permissions", permissions);
        return OBJECT_MAPPER.writeValueAsString(body);
    }

    private static String metadataBody(long version, String displayName, String description) throws Exception {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("expectedVersion", version);
        body.put("displayName", displayName);
        body.put("description", description);
        return OBJECT_MAPPER.writeValueAsString(body);
    }

    private static String permissionDelta(long version, List<String> additions, List<String> removals)
            throws Exception {
        return OBJECT_MAPPER.writeValueAsString(Map.of(
                "expectedVersion", version,
                "addPermissions", additions,
                "removePermissions", removals));
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
