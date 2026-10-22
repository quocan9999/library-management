package sparkminds.librarymanagement.integration.role;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.role.service.RolePermissionAuditEvent;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
@ActiveProfiles("test")
@Transactional
@ExtendWith(OutputCaptureExtension.class)
@Import(RolePermissionMutationIntegrationTests.PermissionProbeConfiguration.class)
class RolePermissionMutationIntegrationTests {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private PermissionMutationTestHooks testHooks;

    @Test
    void dynamicCounterRoleGetsHandoverDependenciesAndKeepsBaseWhenOperationIsRemoved() throws Exception {
        jdbcTemplate.update("INSERT INTO roles (code, display_name) VALUES ('BORROW_COUNTER', 'Borrow fixture')");
        String token = accessToken("admin", "admin");
        MvcResult grant = patchRequest(token, "BORROW_COUNTER",
                body(roleVersion("BORROW_COUNTER"), List.of("book:read", "borrow:handover"), List.of()));
        assertThat(grant.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("BORROW_COUNTER", "borrow:handover")).isEqualTo(1);
        assertThat(permissionCount("BORROW_COUNTER", "borrow:fee-confirm")).isEqualTo(1);
        assertThat(permissionCount("BORROW_COUNTER", "borrow:read")).isEqualTo(1);

        long version = roleVersion("BORROW_COUNTER");
        MvcResult conflict = patchRequest(token, "BORROW_COUNTER",
                body(version, List.of(), List.of("borrow:read")));
        assertThat(conflict.getResponse().getStatus()).isEqualTo(400);
        assertThat(JsonPath.<String>read(conflict.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("ROLE_PERMISSION_DEPENDENCY_CONFLICT");
        assertThat(roleVersion("BORROW_COUNTER")).isEqualTo(version);
        assertThat(permissionCount("BORROW_COUNTER", "borrow:read")).isEqualTo(1);

        MvcResult remove = patchRequest(token, "BORROW_COUNTER",
                body(version, List.of(), List.of("borrow:handover")));
        assertThat(remove.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("BORROW_COUNTER", "borrow:handover")).isZero();
        assertThat(permissionCount("BORROW_COUNTER", "borrow:fee-confirm")).isEqualTo(1);
        assertThat(permissionCount("BORROW_COUNTER", "borrow:read")).isEqualTo(1);
        MvcResult removeAll = patchRequest(token, "BORROW_COUNTER",
                body(roleVersion("BORROW_COUNTER"), List.of(), List.of("borrow:fee-confirm", "borrow:read")));
        assertThat(removeAll.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("BORROW_COUNTER", "borrow:read")).isZero();
        assertThat(permissionCount("BORROW_COUNTER", "book:read")).isEqualTo(1);
    }

    @Test
    void userCannotReceiveCounterPermissionsAndRejectedDeltaDoesNotWrite() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");
        MvcResult response = patchRequest(token, "USER",
                body(version, List.of("borrow:handover"), List.of()));
        assertThat(response.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("USER")).isEqualTo(version);
        assertThat(permissionCount("USER", "borrow:handover")).isZero();
        assertThat(permissionCount("USER", "borrow:fee-confirm")).isZero();
        assertThat(permissionCount("USER", "borrow:read")).isZero();
    }

    @Test
    void adminAppliesDeltaIncrementsVersionOnceAndKeepsUnchangedPermissions() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");

        MvcResult response = patchRequest(token, "USER", body(version,
                List.of("member:create"), List.of("book:read")));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(JsonPath.<String>read(response.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("ROLE_PERMISSIONS_UPDATED");
        assertThat(responseVersion(response)).isEqualTo(version + 1);
        List<String> assigned = JsonPath.read(response.getResponse().getContentAsString(),
                "$.data.assignedPermissions");
        assertThat(assigned).contains("member:create", "borrow:create", "borrow:return");
        assertThat(assigned).contains("member:read");
        assertThat(assigned).doesNotContain("book:read");
        assertThat(roleVersion("USER")).isEqualTo(version + 1);
    }

    @Test
    void grantingAnOperationAddsItsBasePermissionAutomatically() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");
        setPermission("USER", "member:read", false);
        setPermission("USER", "member:create", false);

        MvcResult response = patchRequest(token, "USER",
                body(version, List.of("member:create"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("USER", "member:create")).isEqualTo(1);
        assertThat(permissionCount("USER", "member:read")).isEqualTo(1);
        assertThat(JsonPath.<List<String>>read(response.getResponse().getContentAsString(),
                "$.data.assignedPermissions")).contains("member:create", "member:read");
        assertThat(roleVersion("USER")).isEqualTo(version + 1);
    }

    @Test
    void removingAnOperationKeepsItsBasePermission() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");
        setPermission("USER", "member:read", true);
        setPermission("USER", "member:create", true);

        MvcResult response = patchRequest(token, "USER",
                body(version, List.of(), List.of("member:create")));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("USER", "member:create")).isZero();
        assertThat(permissionCount("USER", "member:read")).isEqualTo(1);
    }

    @Test
    void rejectsRemovingBasePermissionWhileAnOperationStillDependsOnIt() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");
        setPermission("USER", "member:read", true);
        setPermission("USER", "member:create", true);

        MvcResult response = patchRequest(token, "USER",
                body(version, List.of(), List.of("member:read")));

        assertThat(response.getResponse().getStatus()).isEqualTo(400);
        assertThat(JsonPath.<String>read(response.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("ROLE_PERMISSION_DEPENDENCY_CONFLICT");
        assertThat(response.getResponse().getContentAsString()).contains("member:create", "member:read");
        assertThat(permissionCount("USER", "member:create")).isEqualTo(1);
        assertThat(permissionCount("USER", "member:read")).isEqualTo(1);
        assertThat(roleVersion("USER")).isEqualTo(version);
    }

    @Test
    void allowsRemovingBaseAndDependentOperationTogether() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");
        setPermission("USER", "member:read", true);
        setPermission("USER", "member:create", true);

        MvcResult response = patchRequest(token, "USER",
                body(version, List.of(), List.of("member:create", "member:read")));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("USER", "member:create")).isZero();
        assertThat(permissionCount("USER", "member:read")).isZero();
    }

    @Test
    void adminCanGrantDependencyEvenWithoutItsRolePermissionRow() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");
        setPermission("ADMIN", "member:read", false);
        setPermission("USER", "member:read", false);
        setPermission("USER", "member:create", false);

        MvcResult response = patchRequest(token, "USER",
                body(version, List.of("member:create"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("USER", "member:create")).isEqualTo(1);
        assertThat(permissionCount("USER", "member:read")).isEqualTo(1);
        assertThat(roleVersion("USER")).isEqualTo(version + 1);
    }

    @Test
    void emptyAndAlreadySatisfiedDeltasDoNotChangeVersion() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");

        MvcResult empty = patchRequest(token, "USER", body(version, List.of(), List.of()));
        assertThat(empty.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(empty)).isEqualTo(version);

        MvcResult alreadyAssigned = patchRequest(token, "USER",
                body(version, List.of("book:read"), List.of()));
        assertThat(alreadyAssigned.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(alreadyAssigned)).isEqualTo(version);
        assertThat(roleVersion("USER")).isEqualTo(version);
    }

    @Test
    void staleVersionReturnsConflictWithoutApplyingItsDelta() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");

        MvcResult first = patchRequest(token, "USER",
                body(version, List.of("member:create"), List.of()));
        assertThat(first.getResponse().getStatus()).isEqualTo(200);

        MvcResult stale = patchRequest(token, "USER",
                body(version, List.of("member:update"), List.of()));
        assertThat(stale.getResponse().getStatus()).isEqualTo(409);
        assertThat(JsonPath.<String>read(stale.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("ROLE_VERSION_CONFLICT");
        assertThat(roleVersion("USER")).isEqualTo(version + 1);
        assertThat(permissionCount("USER", "member:create")).isEqualTo(1);
        assertThat(permissionCount("USER", "member:update")).isZero();
    }

    @Test
    void adminCanAssignCatalogPermissionsWithinUserScope() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");

        MvcResult response = patchRequest(token, "USER",
                body(version, List.of("book:import"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(roleVersion("USER")).isEqualTo(version + 1);
        assertThat(permissionCount("USER", "book:import")).isEqualTo(1);

        MvcResult configPermission = patchRequest(token, "USER",
                body(version + 1, List.of("config:update"), List.of()));
        assertThat(configPermission.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("USER")).isEqualTo(version + 1);
    }

    @Test
    void adminCanEditUserButCannotEditTheAdminSystemRole() throws Exception {
        String token = accessToken("admin", "admin");
        long adminVersion = roleVersion("ADMIN");

        MvcResult adminUpdate = patchRequest(token, "ADMIN",
                body(adminVersion, List.of("borrow:create"), List.of()));
        assertThat(adminUpdate.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("ADMIN")).isEqualTo(adminVersion);

        long userVersion = roleVersion("USER");
        MvcResult userUpdate = patchRequest(token, "USER",
                body(userVersion, List.of("book:create"), List.of()));
        assertThat(userUpdate.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(userUpdate)).isEqualTo(userVersion + 1);
    }

    @Test
    void adminCannotAssignForbiddenPermissionToUserEvenWhenCatalogContainsIt() throws Exception {
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM permissions WHERE code = ?", Integer.class, "member:status:update"))
                .isEqualTo(1);
        Permission unclassifiedPermission = new Permission();
        unclassifiedPermission.setCode("future:catalog:read");
        unclassifiedPermission.setDescription("Test-only unclassified permission");
        permissionRepository.saveAndFlush(unclassifiedPermission);

        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");
        MvcResult response = patchRequest(token, "USER",
                body(version, List.of(
                        "member:status:update", "role:read", "role:update", "config:read", "config:update",
                        "future:catalog:read"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("USER")).isEqualTo(version);
        assertThat(permissionCount("USER", "member:status:update")).isZero();
        assertThat(permissionCount("USER", "future:catalog:read")).isZero();
    }

    @Test
    void unknownTargetsAndProtectedAdminAndUserTargetsAreForbidden()
            throws Exception {
        String adminToken = accessToken("admin", "admin");
        String userToken = accessToken("user", "user");
        long userVersion = roleVersion("USER");

        MvcResult unknown = patchRequest(adminToken, "SUPER_ADMIN",
                body(0, List.of(), List.of()));
        assertThat(unknown.getResponse().getStatus()).isEqualTo(404);

        MvcResult ownRole = patchRequest(adminToken, "ADMIN",
                body(roleVersion("ADMIN"), List.of(), List.of()));
        assertThat(ownRole.getResponse().getStatus()).isEqualTo(403);

        MvcResult user = patchRequest(userToken, "USER", body(userVersion, List.of(), List.of()));
        assertThat(user.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("USER")).isEqualTo(userVersion);
    }

    @Test
    void unauthenticatedMutationReturnsUnauthorized() throws Exception {
        MvcResult response = mockMvc.perform(patch("/api/v1/roles/USER/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(roleVersion("USER"), List.of("member:create"), List.of())))
                .andReturn();

        assertThat(response.getResponse().getStatus()).isEqualTo(401);
    }

    @ParameterizedTest
    @MethodSource("invalidDeltas")
    void malformedOrInvalidDeltasReturnBadRequestWithoutChangingRole(String rawBody) throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("USER");

        MvcResult response = patchRequest(token, "USER", rawBody);

        assertThat(response.getResponse().getStatus()).isEqualTo(400);
        assertThat(roleVersion("USER")).isEqualTo(version);
        assertThat(permissionCount("USER", "member:create")).isZero();
    }

    private static Stream<Arguments> invalidDeltas() {
        String oversizedAddList = IntStream.range(0, 101)
                .mapToObj(index -> "\"unknown:" + index + "\"")
                .collect(java.util.stream.Collectors.joining(","));
        return Stream.of(
                Arguments.of("{\"expectedVersion\":0,\"addPermissions\":[\"book:create\",\"book:create\"],\"removePermissions\":[]}"),
                Arguments.of("{\"expectedVersion\":0,\"addPermissions\":[\"book:create\"],\"removePermissions\":[\"book:create\"]}"),
                Arguments.of("{\"expectedVersion\":0,\"addPermissions\":[\"unknown:permission\"],\"removePermissions\":[]}"),
                Arguments.of("{\"expectedVersion\":-1,\"addPermissions\":[],\"removePermissions\":[]}"),
                Arguments.of("{\"expectedVersion\":0.5,\"addPermissions\":[],\"removePermissions\":[]}"),
                Arguments.of("{\"expectedVersion\":\"0\",\"addPermissions\":[],\"removePermissions\":[]}"),
                Arguments.of("{\"expectedVersion\":null,\"addPermissions\":[],\"removePermissions\":[]}"),
                Arguments.of("{\"expectedVersion\":0,\"addPermissions\":null,\"removePermissions\":[]}"),
                Arguments.of("{\"expectedVersion\":0,\"addPermissions\":[\"book:create\"]}"),
                Arguments.of("{\"expectedVersion\":0,\"addPermissions\":[\"book:create\"],\"removePermissions\":\"book:read\"}"),
                Arguments.of("not-json"),
                Arguments.of("{\"expectedVersion\":0,\"addPermissions\":[" + oversizedAddList
                        + "],\"removePermissions\":[]}")
        );
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void removingAdminRoleReadAndUpdateRowsDoesNotRevokeGlobalRights() throws Exception {
        String token = accessToken("admin", "admin");
        long userVersion = roleVersion("USER");
        boolean hadMemberRead = permissionCount("USER", "member:read") == 1;
        boolean hadMemberCreate = permissionCount("USER", "member:create") == 1;
        boolean hadRoleRead = permissionCount("ADMIN", "role:read") == 1;
        boolean hadRoleUpdate = permissionCount("ADMIN", "role:update") == 1;
        removePermission("ADMIN", "role:read");
        removePermission("ADMIN", "role:update");
        setPermission("USER", "member:read", false);
        setPermission("USER", "member:create", false);

        try {
            mockMvc.perform(get("/api/v1/roles").header("Authorization", "Bearer " + token))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
            MvcResult allowed = patchRequest(token, "USER",
                    body(userVersion, List.of("member:create"), List.of()));
            assertThat(allowed.getResponse().getStatus()).isEqualTo(200);
            assertThat(permissionCount("USER", "member:create")).isEqualTo(1);
            assertThat(permissionCount("USER", "member:read")).isEqualTo(1);
            assertThat(roleVersion("USER")).isEqualTo(userVersion + 1);
        } finally {
            setPermission("ADMIN", "role:read", hadRoleRead);
            setPermission("ADMIN", "role:update", hadRoleUpdate);
            setPermission("USER", "member:read", hadMemberRead);
            setPermission("USER", "member:create", hadMemberCreate);
            setRoleVersion("USER", userVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void removingAdminMemberReadRowDoesNotRemoveGlobalMemberRead() throws Exception {
        String token = accessToken("admin", "admin");
        assertThat(permissionCount("ADMIN", "member:read")).isEqualTo(1);
        removePermission("ADMIN", "member:read");

        try {
            MvcResult stillAllowed = mockMvc.perform(get("/__test/role-permissions/member-read")
                            .header("Authorization", "Bearer " + token))
                    .andReturn();
            assertThat(stillAllowed.getResponse().getStatus()).isEqualTo(200);
        } finally {
            grantPermission("ADMIN", "member:read");
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void exceptionAfterDatabaseWritesRollsBackPermissionLinksAndVersionAndDoesNotWriteAudit(CapturedOutput output)
            throws Exception {
        String token = accessToken("admin", "admin");
        Integer actorId = accountRepository.findByUsername("admin").orElseThrow().getId();
        long userVersion = roleVersion("USER");
        boolean hadMemberCreate = permissionCount("USER", "member:create") == 1;
        boolean hadMemberRead = permissionCount("USER", "member:read") == 1;
        setPermission("USER", "member:create", false);
        setPermission("USER", "member:read", false);
        testHooks.failNextUpdateAfterDatabaseWrites(actorId, "USER");
        try {
            MvcResult response = patchRequest(token, "USER",
                    body(userVersion, List.of("member:create"), List.of("book:read")));

            assertThat(response.getResponse().getStatus()).isEqualTo(500);
            assertThat(JsonPath.<String>read(response.getResponse().getContentAsString(), "$.code"))
                    .isEqualTo("INTERNAL_ERROR");
            assertThat(roleVersion("USER")).isEqualTo(userVersion);
            assertThat(permissionCount("USER", "book:read")).isEqualTo(1);
            assertThat(permissionCount("USER", "book:create")).isZero();
            assertThat(permissionCount("USER", "member:create")).isZero();
            assertThat(permissionCount("USER", "member:read")).isZero();
            assertThat(output.getOut() + output.getErr()).doesNotContain("role-permission-update actorId=");
        } finally {
            testHooks.reset();
            setPermission("USER", "member:create", hadMemberCreate);
            setPermission("USER", "member:read", hadMemberRead);
            setRoleVersion("USER", userVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRequestsWithSameVersionHaveOneWinner() throws Exception {
        String token = accessToken("admin", "admin");
        long initialVersion = roleVersion("USER");
        boolean hadBookCreate = permissionCount("USER", "book:create") == 1;
        boolean hadBookUpdate = permissionCount("USER", "book:update") == 1;
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        Callable<MvcResult> createRequest = () -> concurrentPatch(token, initialVersion,
                "book:create", ready, start);
        Callable<MvcResult> updateRequest = () -> concurrentPatch(token, initialVersion,
                "book:update", ready, start);
        Future<MvcResult> first = executor.submit(createRequest);
        Future<MvcResult> second = executor.submit(updateRequest);
        try {
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            MvcResult firstResult = first.get(30, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(30, TimeUnit.SECONDS);

            assertThat(List.of(firstResult.getResponse().getStatus(), secondResult.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(roleVersion("USER")).isEqualTo(initialVersion + 1);
            assertThat(permissionCount("USER", "book:create")
                    + permissionCount("USER", "book:update")).isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
            setPermission("USER", "book:create", hadBookCreate);
            setPermission("USER", "book:update", hadBookUpdate);
            setRoleVersion("USER", initialVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void successfulDeltaWritesAfterCommitAuditWithoutCredentialsOrPersonalData(CapturedOutput output)
            throws Exception {
        String token = accessToken("admin", "admin");
        Integer actorId = accountRepository.findByUsername("admin").orElseThrow().getId();
        long userVersion = roleVersion("USER");
        boolean hadMemberRead = permissionCount("USER", "member:read") == 1;
        boolean hadMemberCreate = permissionCount("USER", "member:create") == 1;
        setPermission("USER", "member:read", false);
        setPermission("USER", "member:create", false);

        try {
            MvcResult response = patchRequest(token, "USER",
                    body(userVersion, List.of("member:create"), List.of()));

            assertThat(response.getResponse().getStatus()).isEqualTo(200);
            String logs = output.getOut() + output.getErr();
            assertThat(logs).contains("role-permission-update", "actorId=" + actorId,
                    "roleCode=USER", "addedPermissions=[member:create, member:read]", "removedPermissions=[]");
            assertThat(logs).doesNotContain(token, "password=", "admin@example");
            assertThat(logs).containsPattern("occurredAt=[^ ]+Z");
        } finally {
            setPermission("USER", "member:read", hadMemberRead);
            setPermission("USER", "member:create", hadMemberCreate);
            setRoleVersion("USER", userVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void noOpDeltaKeepsVersionAndDoesNotWriteAudit(CapturedOutput output) throws Exception {
        String token = accessToken("admin", "admin");
        long userVersion = roleVersion("USER");

        MvcResult response = patchRequest(token, "USER",
                body(userVersion, List.of("book:read"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(response)).isEqualTo(userVersion);
        assertThat(roleVersion("USER")).isEqualTo(userVersion);
        assertThat(output.getOut() + output.getErr()).doesNotContain("role-permission-update actorId=");
    }

    private MvcResult concurrentPatch(
            String token,
            long version,
            String permission,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for concurrent request start");
        }
        return patchRequest(token, "USER", body(version, List.of(permission), List.of()));
    }

    private MvcResult patchRequest(String token, String roleCode, String requestBody) throws Exception {
        MockHttpServletRequestBuilder request = patch("/api/v1/roles/{roleCode}/permissions", roleCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request).andReturn();
    }

    private static long responseVersion(MvcResult response) throws Exception {
        Number version = JsonPath.read(response.getResponse().getContentAsString(), "$.data.version");
        return version.longValue();
    }

    private String accessToken(String username, String password) throws Exception {
        String loginBody = OBJECT_MAPPER.writeValueAsString(Map.of(
                "identifier", username,
                "password", password
        ));
        MvcResult response = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andReturn();
        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        return JsonPath.read(response.getResponse().getContentAsString(), "$.data.accessToken");
    }

    private static String body(long version, List<String> add, List<String> remove) throws Exception {
        return OBJECT_MAPPER.writeValueAsString(Map.of(
                "expectedVersion", version,
                "addPermissions", add,
                "removePermissions", remove
        ));
    }

    private long roleVersion(String roleCode) {
        return jdbcTemplate.queryForObject("SELECT version FROM roles WHERE code = ?", Long.class, roleCode);
    }

    private int permissionCount(String roleCode, String permissionCode) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = ? AND p.code = ?
                """, Integer.class, roleCode, permissionCode);
    }

    private void removePermission(String roleCode, String permissionCode) {
        jdbcTemplate.update("""
                DELETE rp FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = ? AND p.code = ?
                """, roleCode, permissionCode);
    }

    private void grantPermission(String roleCode, String permissionCode) {
        jdbcTemplate.update("""
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
                WHERE r.code = ? AND p.code = ?
                  AND NOT EXISTS (
                    SELECT 1 FROM role_permissions rp
                    WHERE rp.role_id = r.id AND rp.permission_id = p.id
                  )
                """, roleCode, permissionCode);
    }

    private void setPermission(String roleCode, String permissionCode, boolean shouldBeAssigned) {
        if (shouldBeAssigned) {
            grantPermission(roleCode, permissionCode);
        } else {
            removePermission(roleCode, permissionCode);
        }
    }

    private void setRoleVersion(String roleCode, long version) {
        jdbcTemplate.update("UPDATE roles SET version = ? WHERE code = ?", version, roleCode);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PermissionProbeConfiguration {

        @Bean
        PermissionMutationTestHooks permissionMutationTestHooks() {
            return new PermissionMutationTestHooks();
        }

        @Bean
        PermissionProbeController permissionProbeController() {
            return new PermissionProbeController();
        }

        @Bean
        PermissionMutationTestListener permissionMutationTestListener(
                PermissionMutationTestHooks hooks
        ) {
            return new PermissionMutationTestListener(hooks);
        }

    }

    static final class PermissionMutationTestHooks {

        private final AtomicReference<FailureTarget> failureTarget = new AtomicReference<>();
        void failNextUpdateAfterDatabaseWrites(Integer actorId, String targetRoleCode) {
            failureTarget.set(new FailureTarget(actorId, targetRoleCode));
        }

        void onRolePermissionUpdate(RolePermissionAuditEvent event) {
            FailureTarget failure = failureTarget.get();
            if (failure != null && failure.matches(event) && failureTarget.compareAndSet(failure, null)) {
                throw new IllegalStateException("test failure after permission SQL writes");
            }

        }

        void reset() {
            failureTarget.set(null);
        }

        private record FailureTarget(Integer actorId, String roleCode) {
            boolean matches(RolePermissionAuditEvent event) {
                return actorId.equals(event.actorId()) && roleCode.equals(event.roleCode());
            }
        }

    }

    static final class PermissionMutationTestListener {

        private final PermissionMutationTestHooks hooks;

        PermissionMutationTestListener(PermissionMutationTestHooks hooks) {
            this.hooks = hooks;
        }

        @EventListener
        void onRolePermissionUpdate(RolePermissionAuditEvent event) {
            hooks.onRolePermissionUpdate(event);
        }
    }

    @RestController
    @RequestMapping("/__test/role-permissions")
    static class PermissionProbeController {

        @GetMapping("/member-read")
        @PreAuthorize("hasAuthority('member:read')")
        String readMemberPermissionProbe() {
            return "allowed";
        }
    }
}
