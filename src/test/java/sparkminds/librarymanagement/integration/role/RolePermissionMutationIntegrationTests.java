package sparkminds.librarymanagement.integration.role;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
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
@AutoConfigureMockMvc
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
    void adminAppliesDeltaIncrementsVersionOnceAndKeepsUnchangedPermissions() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");

        MvcResult response = patchRequest(token, "ROLE_USER", body(version,
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
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version + 1);
    }

    @Test
    void grantingAnOperationAddsItsBasePermissionAutomatically() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");
        setPermission("ROLE_USER", "member:read", false);
        setPermission("ROLE_USER", "member:create", false);

        MvcResult response = patchRequest(token, "ROLE_USER",
                body(version, List.of("member:create"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("ROLE_USER", "member:create")).isEqualTo(1);
        assertThat(permissionCount("ROLE_USER", "member:read")).isEqualTo(1);
        assertThat(JsonPath.<List<String>>read(response.getResponse().getContentAsString(),
                "$.data.assignedPermissions")).contains("member:create", "member:read");
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version + 1);
    }

    @Test
    void removingAnOperationKeepsItsBasePermission() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");
        setPermission("ROLE_USER", "member:read", true);
        setPermission("ROLE_USER", "member:create", true);

        MvcResult response = patchRequest(token, "ROLE_USER",
                body(version, List.of(), List.of("member:create")));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("ROLE_USER", "member:create")).isZero();
        assertThat(permissionCount("ROLE_USER", "member:read")).isEqualTo(1);
    }

    @Test
    void rejectsRemovingBasePermissionWhileAnOperationStillDependsOnIt() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");
        setPermission("ROLE_USER", "member:read", true);
        setPermission("ROLE_USER", "member:create", true);

        MvcResult response = patchRequest(token, "ROLE_USER",
                body(version, List.of(), List.of("member:read")));

        assertThat(response.getResponse().getStatus()).isEqualTo(400);
        assertThat(JsonPath.<String>read(response.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("ROLE_PERMISSION_DEPENDENCY_CONFLICT");
        assertThat(response.getResponse().getContentAsString()).contains("member:create", "member:read");
        assertThat(permissionCount("ROLE_USER", "member:create")).isEqualTo(1);
        assertThat(permissionCount("ROLE_USER", "member:read")).isEqualTo(1);
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version);
    }

    @Test
    void allowsRemovingBaseAndDependentOperationTogether() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");
        setPermission("ROLE_USER", "member:read", true);
        setPermission("ROLE_USER", "member:create", true);

        MvcResult response = patchRequest(token, "ROLE_USER",
                body(version, List.of(), List.of("member:create", "member:read")));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(permissionCount("ROLE_USER", "member:create")).isZero();
        assertThat(permissionCount("ROLE_USER", "member:read")).isZero();
    }

    @Test
    void rejectsAutomaticDependencyGrantWhenActorCannotGrantThatPermission() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");
        setPermission("ROLE_ADMIN", "member:read", false);
        setPermission("ROLE_USER", "member:read", false);
        setPermission("ROLE_USER", "member:create", false);

        MvcResult response = patchRequest(token, "ROLE_USER",
                body(version, List.of("member:create"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(403);
        assertThat(permissionCount("ROLE_USER", "member:create")).isZero();
        assertThat(permissionCount("ROLE_USER", "member:read")).isZero();
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version);
    }

    @Test
    void emptyAndAlreadySatisfiedDeltasDoNotChangeVersion() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");

        MvcResult empty = patchRequest(token, "ROLE_USER", body(version, List.of(), List.of()));
        assertThat(empty.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(empty)).isEqualTo(version);

        MvcResult alreadyAssigned = patchRequest(token, "ROLE_USER",
                body(version, List.of("book:read"), List.of()));
        assertThat(alreadyAssigned.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(alreadyAssigned)).isEqualTo(version);
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version);
    }

    @Test
    void staleVersionReturnsConflictWithoutApplyingItsDelta() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");

        MvcResult first = patchRequest(token, "ROLE_USER",
                body(version, List.of("member:create"), List.of()));
        assertThat(first.getResponse().getStatus()).isEqualTo(200);

        MvcResult stale = patchRequest(token, "ROLE_USER",
                body(version, List.of("member:update"), List.of()));
        assertThat(stale.getResponse().getStatus()).isEqualTo(409);
        assertThat(JsonPath.<String>read(stale.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("ROLE_VERSION_CONFLICT");
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version + 1);
        assertThat(permissionCount("ROLE_USER", "member:create")).isEqualTo(1);
        assertThat(permissionCount("ROLE_USER", "member:update")).isZero();
    }

    @Test
    void adminCannotAssignPermissionItDoesNotCurrentlyOwn() throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");

        MvcResult response = patchRequest(token, "ROLE_USER",
                body(version, List.of("borrow:create"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(403);
        assertThat(JsonPath.<String>read(response.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("PERMISSION_DENIED");
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version);
        assertThat(permissionCount("ROLE_USER", "borrow:create")).isEqualTo(1);

        MvcResult configPermission = patchRequest(token, "ROLE_USER",
                body(version, List.of("config:update"), List.of()));
        assertThat(configPermission.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version);
    }

    @Test
    void superAdminCanEditAdminButCannotEditItself() throws Exception {
        String token = accessToken("superadmin", "superadmin");
        long adminVersion = roleVersion("ROLE_ADMIN");

        MvcResult adminUpdate = patchRequest(token, "ROLE_ADMIN",
                body(adminVersion, List.of("borrow:create"), List.of()));
        assertThat(adminUpdate.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(adminUpdate)).isEqualTo(adminVersion + 1);

        long userVersion = roleVersion("ROLE_USER");
        MvcResult userUpdate = patchRequest(token, "ROLE_USER",
                body(userVersion, List.of("book:create"), List.of()));
        assertThat(userUpdate.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(userUpdate)).isEqualTo(userVersion + 1);

        long superAdminVersion = roleVersion("ROLE_SUPER_ADMIN");
        MvcResult selfUpdate = patchRequest(token, "ROLE_SUPER_ADMIN",
                body(superAdminVersion, List.of(), List.of()));
        assertThat(selfUpdate.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("ROLE_SUPER_ADMIN")).isEqualTo(superAdminVersion);
    }

    @Test
    void superAdminCannotAssignForbiddenPermissionToUserEvenWhenCatalogContainsIt() throws Exception {
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM permissions WHERE code = ?", Integer.class, "member:status:update"))
                .isEqualTo(1);
        Permission unclassifiedPermission = new Permission();
        unclassifiedPermission.setCode("future:catalog:read");
        unclassifiedPermission.setDescription("Test-only unclassified permission");
        permissionRepository.saveAndFlush(unclassifiedPermission);

        String token = accessToken("superadmin", "superadmin");
        long version = roleVersion("ROLE_USER");
        MvcResult response = patchRequest(token, "ROLE_USER",
                body(version, List.of(
                        "member:status:update", "role:read", "role:update", "config:read", "config:update",
                        "future:catalog:read"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version);
        assertThat(permissionCount("ROLE_USER", "member:status:update")).isZero();
        assertThat(permissionCount("ROLE_USER", "future:catalog:read")).isZero();
    }

    @Test
    void unknownAndInvisibleTargetsReturnNotFoundWhileVisibleButUneditableAndUserTargetsAreForbidden()
            throws Exception {
        String adminToken = accessToken("admin", "admin");
        String superAdminToken = accessToken("superadmin", "superadmin");
        String userToken = accessToken("user", "user");
        long userVersion = roleVersion("ROLE_USER");

        MvcResult invisible = patchRequest(adminToken, "ROLE_SUPER_ADMIN",
                body(roleVersion("ROLE_SUPER_ADMIN"), List.of(), List.of()));
        assertThat(invisible.getResponse().getStatus()).isEqualTo(404);
        assertThat(JsonPath.<String>read(invisible.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("ROLE_NOT_FOUND");

        MvcResult unknown = patchRequest(superAdminToken, "ROLE_NOT_PRESENT",
                body(0, List.of(), List.of()));
        assertThat(unknown.getResponse().getStatus()).isEqualTo(404);

        MvcResult ownRole = patchRequest(adminToken, "ROLE_ADMIN",
                body(roleVersion("ROLE_ADMIN"), List.of(), List.of()));
        assertThat(ownRole.getResponse().getStatus()).isEqualTo(403);

        MvcResult user = patchRequest(userToken, "ROLE_USER", body(userVersion, List.of(), List.of()));
        assertThat(user.getResponse().getStatus()).isEqualTo(403);
        assertThat(roleVersion("ROLE_USER")).isEqualTo(userVersion);
    }

    @Test
    void unauthenticatedMutationReturnsUnauthorized() throws Exception {
        MvcResult response = mockMvc.perform(patch("/api/v1/roles/ROLE_USER/permissions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(roleVersion("ROLE_USER"), List.of("member:create"), List.of())))
                .andReturn();

        assertThat(response.getResponse().getStatus()).isEqualTo(401);
    }

    @ParameterizedTest
    @MethodSource("invalidDeltas")
    void malformedOrInvalidDeltasReturnBadRequestWithoutChangingRole(String rawBody) throws Exception {
        String token = accessToken("admin", "admin");
        long version = roleVersion("ROLE_USER");

        MvcResult response = patchRequest(token, "ROLE_USER", rawBody);

        assertThat(response.getResponse().getStatus()).isEqualTo(400);
        assertThat(roleVersion("ROLE_USER")).isEqualTo(version);
        assertThat(permissionCount("ROLE_USER", "member:create")).isZero();
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
    void revokedRoleReadIsRecheckedAtSaveAndSameTokenWorksAfterRegrant() throws Exception {
        String token = accessToken("admin", "admin");
        long userVersion = roleVersion("ROLE_USER");
        boolean hadMemberRead = permissionCount("ROLE_USER", "member:read") == 1;
        boolean hadMemberCreate = permissionCount("ROLE_USER", "member:create") == 1;
        removePermission("ROLE_ADMIN", "role:read");

        try {
            MvcResult denied = patchRequest(token, "ROLE_USER",
                    body(userVersion, List.of("member:create"), List.of()));
            assertThat(denied.getResponse().getStatus()).isEqualTo(403);
            assertThat(roleVersion("ROLE_USER")).isEqualTo(userVersion);

            grantPermission("ROLE_ADMIN", "role:read");
            MvcResult allowedAfterRegrant = patchRequest(token, "ROLE_USER",
                    body(userVersion, List.of("member:create"), List.of()));
            assertThat(allowedAfterRegrant.getResponse().getStatus()).isEqualTo(200);
        } finally {
            grantPermission("ROLE_ADMIN", "role:read");
            setPermission("ROLE_USER", "member:read", hadMemberRead);
            setPermission("ROLE_USER", "member:create", hadMemberCreate);
            setRoleVersion("ROLE_USER", userVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void revokedRoleUpdateIsRecheckedOnNextRequestAndCanBeRestoredWithoutLogin() throws Exception {
        String token = accessToken("admin", "admin");
        long userVersion = roleVersion("ROLE_USER");
        boolean hadMemberRead = permissionCount("ROLE_USER", "member:read") == 1;
        boolean hadMemberCreate = permissionCount("ROLE_USER", "member:create") == 1;
        removePermission("ROLE_ADMIN", "role:update");

        try {
            MvcResult denied = patchRequest(token, "ROLE_USER",
                    body(userVersion, List.of("member:create"), List.of()));
            assertThat(denied.getResponse().getStatus()).isEqualTo(403);
            assertThat(roleVersion("ROLE_USER")).isEqualTo(userVersion);

            grantPermission("ROLE_ADMIN", "role:update");
            MvcResult allowedAfterRegrant = patchRequest(token, "ROLE_USER",
                    body(userVersion, List.of("member:create"), List.of()));
            assertThat(allowedAfterRegrant.getResponse().getStatus()).isEqualTo(200);
        } finally {
            grantPermission("ROLE_ADMIN", "role:update");
            setPermission("ROLE_USER", "member:read", hadMemberRead);
            setPermission("ROLE_USER", "member:create", hadMemberCreate);
            setRoleVersion("ROLE_USER", userVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void revokingMemberReadBlocksTheNextRequestAndRegrantingRestoresItWithoutLogin() throws Exception {
        String token = accessToken("admin", "admin");
        assertThat(permissionCount("ROLE_ADMIN", "member:read")).isEqualTo(1);
        removePermission("ROLE_ADMIN", "member:read");

        try {
            MvcResult denied = mockMvc.perform(get("/__test/role-permissions/member-read")
                            .header("Authorization", "Bearer " + token))
                    .andReturn();
            assertThat(denied.getResponse().getStatus()).isEqualTo(403);

            grantPermission("ROLE_ADMIN", "member:read");
            MvcResult allowedAfterRegrant = mockMvc.perform(get("/__test/role-permissions/member-read")
                            .header("Authorization", "Bearer " + token))
                    .andReturn();
            assertThat(allowedAfterRegrant.getResponse().getStatus()).isEqualTo(200);
        } finally {
            grantPermission("ROLE_ADMIN", "member:read");
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void exceptionAfterDatabaseWritesRollsBackPermissionLinksAndVersionAndDoesNotWriteAudit(CapturedOutput output)
            throws Exception {
        String token = accessToken("admin", "admin");
        Integer actorId = accountRepository.findByUsername("admin").orElseThrow().getId();
        long userVersion = roleVersion("ROLE_USER");
        testHooks.failNextUpdateAfterDatabaseWrites(actorId, "ROLE_USER");
        try {
            MvcResult response = patchRequest(token, "ROLE_USER",
                    body(userVersion, List.of("member:create"), List.of("book:read")));

            assertThat(response.getResponse().getStatus()).isEqualTo(500);
            assertThat(JsonPath.<String>read(response.getResponse().getContentAsString(), "$.code"))
                    .isEqualTo("INTERNAL_ERROR");
            assertThat(roleVersion("ROLE_USER")).isEqualTo(userVersion);
            assertThat(permissionCount("ROLE_USER", "book:read")).isEqualTo(1);
            assertThat(permissionCount("ROLE_USER", "book:create")).isZero();
            assertThat(permissionCount("ROLE_USER", "member:create")).isZero();
            assertThat(permissionCount("ROLE_USER", "member:read")).isZero();
            assertThat(output.getOut() + output.getErr()).doesNotContain("role-permission-update actorId=");
        } finally {
            testHooks.reset();
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRequestsWithSameVersionHaveOneWinner() throws Exception {
        String token = accessToken("admin", "admin");
        long initialVersion = roleVersion("ROLE_USER");
        boolean hadBookCreate = permissionCount("ROLE_USER", "book:create") == 1;
        boolean hadBookUpdate = permissionCount("ROLE_USER", "book:update") == 1;
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
            assertThat(roleVersion("ROLE_USER")).isEqualTo(initialVersion + 1);
            assertThat(permissionCount("ROLE_USER", "book:create")
                    + permissionCount("ROLE_USER", "book:update")).isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
            setPermission("ROLE_USER", "book:create", hadBookCreate);
            setPermission("ROLE_USER", "book:update", hadBookUpdate);
            setRoleVersion("ROLE_USER", initialVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void superAdminRevocationThatWinsLockBeforeAdminSaveMakesTheInFlightAdminRequestForbidden()
            throws Exception {
        String superAdminToken = accessToken("superadmin", "superadmin");
        String adminToken = accessToken("admin", "admin");
        long adminVersion = roleVersion("ROLE_ADMIN");
        long userVersion = roleVersion("ROLE_USER");
        Integer superAdminId = accountRepository.findByUsername("superadmin").orElseThrow().getId();
        Integer adminId = accountRepository.findByUsername("admin").orElseThrow().getId();
        boolean hadMemberCreate = permissionCount("ROLE_USER", "member:create") == 1;
        ExecutorService executor = Executors.newFixedThreadPool(2);
        testHooks.armSuperAdminRevocationRace(superAdminId, adminId);
        try {
            Future<MvcResult> superAdminChange = executor.submit(() -> patchRequest(
                    superAdminToken, "ROLE_ADMIN", body(adminVersion, List.of(), List.of("role:update"))));
            assertThat(testHooks.awaitSuperAdminChangeApplied()).isTrue();

            Future<MvcResult> adminChange = executor.submit(() -> patchRequest(
                    adminToken, "ROLE_USER", body(userVersion, List.of("member:create"), List.of())));
            assertThat(testHooks.awaitAdminRequestAuthenticated()).isTrue();

            testHooks.allowSuperAdminCommit();

            MvcResult superAdminResult = superAdminChange.get(20, TimeUnit.SECONDS);
            testHooks.allowAdminRequestToContinue();
            MvcResult adminResult = adminChange.get(20, TimeUnit.SECONDS);
            assertThat(superAdminResult.getResponse().getStatus()).isEqualTo(200);
            assertThat(adminResult.getResponse().getStatus()).isEqualTo(403);
            assertThat(permissionCount("ROLE_ADMIN", "role:update")).isZero();
            assertThat(permissionCount("ROLE_USER", "member:create")).isEqualTo(hadMemberCreate ? 1 : 0);
            assertThat(roleVersion("ROLE_ADMIN")).isEqualTo(adminVersion + 1);
            assertThat(roleVersion("ROLE_USER")).isEqualTo(userVersion);
        } finally {
            testHooks.allowSuperAdminCommit();
            testHooks.allowAdminRequestToContinue();
            executor.shutdownNow();
            executor.awaitTermination(10, TimeUnit.SECONDS);
            grantPermission("ROLE_ADMIN", "role:update");
            setPermission("ROLE_USER", "member:create", hadMemberCreate);
            setRoleVersion("ROLE_ADMIN", adminVersion);
            setRoleVersion("ROLE_USER", userVersion);
            testHooks.reset();
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void successfulDeltaWritesAfterCommitAuditWithoutCredentialsOrPersonalData(CapturedOutput output)
            throws Exception {
        String token = accessToken("admin", "admin");
        Integer actorId = accountRepository.findByUsername("admin").orElseThrow().getId();
        long userVersion = roleVersion("ROLE_USER");
        boolean hadMemberRead = permissionCount("ROLE_USER", "member:read") == 1;
        boolean hadMemberCreate = permissionCount("ROLE_USER", "member:create") == 1;
        setPermission("ROLE_USER", "member:read", false);
        setPermission("ROLE_USER", "member:create", false);

        try {
            MvcResult response = patchRequest(token, "ROLE_USER",
                    body(userVersion, List.of("member:create"), List.of()));

            assertThat(response.getResponse().getStatus()).isEqualTo(200);
            String logs = output.getOut() + output.getErr();
            assertThat(logs).contains("role-permission-update", "actorId=" + actorId,
                    "roleCode=ROLE_USER", "addedPermissions=[member:create, member:read]", "removedPermissions=[]");
            assertThat(logs).doesNotContain(token, "password=", "admin@example");
            assertThat(logs).containsPattern("occurredAt=[^ ]+Z");
        } finally {
            setPermission("ROLE_USER", "member:read", hadMemberRead);
            setPermission("ROLE_USER", "member:create", hadMemberCreate);
            setRoleVersion("ROLE_USER", userVersion);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void noOpDeltaKeepsVersionAndDoesNotWriteAudit(CapturedOutput output) throws Exception {
        String token = accessToken("admin", "admin");
        long userVersion = roleVersion("ROLE_USER");

        MvcResult response = patchRequest(token, "ROLE_USER",
                body(userVersion, List.of("book:read"), List.of()));

        assertThat(response.getResponse().getStatus()).isEqualTo(200);
        assertThat(responseVersion(response)).isEqualTo(userVersion);
        assertThat(roleVersion("ROLE_USER")).isEqualTo(userVersion);
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
        return patchRequest(token, "ROLE_USER", body(version, List.of(permission), List.of()));
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

        @Bean
        WebMvcConfigurer permissionMutationRequestGate(PermissionMutationTestHooks hooks) {
            return new WebMvcConfigurer() {
                @Override
                public void addInterceptors(InterceptorRegistry registry) {
                    HandlerInterceptor interceptor = new HandlerInterceptor() {
                        @Override
                        public boolean preHandle(
                                HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler
                        ) {
                            if ("PATCH".equals(request.getMethod())) {
                                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                                if (authentication != null
                                        && authentication.getPrincipal() instanceof CustomUserPrincipal principal) {
                                    hooks.pauseAuthenticatedAdminRequest(principal);
                                }
                            }
                            return true;
                        }
                    };
                    registry.addInterceptor(interceptor)
                            .addPathPatterns("/api/v1/roles/ROLE_USER/permissions");
                }
            };
        }
    }

    static final class PermissionMutationTestHooks {

        private final AtomicReference<FailureTarget> failureTarget = new AtomicReference<>();
        private final AtomicReference<RevocationRace> revocationRace = new AtomicReference<>();

        void failNextUpdateAfterDatabaseWrites(Integer actorId, String targetRoleCode) {
            failureTarget.set(new FailureTarget(actorId, targetRoleCode));
        }

        void armSuperAdminRevocationRace(Integer superAdminId, Integer adminId) {
            revocationRace.set(new RevocationRace(superAdminId, adminId));
        }

        void onRolePermissionUpdate(RolePermissionAuditEvent event) {
            FailureTarget failure = failureTarget.get();
            if (failure != null && failure.matches(event) && failureTarget.compareAndSet(failure, null)) {
                throw new IllegalStateException("test failure after permission SQL writes");
            }

            RevocationRace race = revocationRace.get();
            if (race != null && race.isSuperAdminRevokingRoleUpdate(event)) {
                race.superAdminChangeApplied.countDown();
                await(race.allowSuperAdminCommit, "SuperAdmin test transaction release timed out");
            }
        }

        void pauseAuthenticatedAdminRequest(CustomUserPrincipal principal) {
            RevocationRace race = revocationRace.get();
            if (race != null && race.isAdminRequest(principal)) {
                race.adminRequestAuthenticated.countDown();
                await(race.allowAdminRequestToContinue, "Admin test request release timed out");
            }
        }

        boolean awaitSuperAdminChangeApplied() throws InterruptedException {
            RevocationRace race = requireRace();
            return race.superAdminChangeApplied.await(15, TimeUnit.SECONDS);
        }

        boolean awaitAdminRequestAuthenticated() throws InterruptedException {
            RevocationRace race = requireRace();
            return race.adminRequestAuthenticated.await(15, TimeUnit.SECONDS);
        }

        void allowSuperAdminCommit() {
            RevocationRace race = revocationRace.get();
            if (race != null) {
                race.allowSuperAdminCommit.countDown();
            }
        }

        void allowAdminRequestToContinue() {
            RevocationRace race = revocationRace.get();
            if (race != null) {
                race.allowAdminRequestToContinue.countDown();
            }
        }

        void reset() {
            failureTarget.set(null);
            allowSuperAdminCommit();
            allowAdminRequestToContinue();
            revocationRace.set(null);
        }

        private RevocationRace requireRace() {
            RevocationRace race = revocationRace.get();
            if (race == null) {
                throw new IllegalStateException("No role permission race is armed");
            }
            return race;
        }

        private static void await(CountDownLatch latch, String timeoutMessage) {
            try {
                if (!latch.await(20, TimeUnit.SECONDS)) {
                    throw new IllegalStateException(timeoutMessage);
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Test synchronization was interrupted", exception);
            }
        }

        private record FailureTarget(Integer actorId, String roleCode) {
            boolean matches(RolePermissionAuditEvent event) {
                return actorId.equals(event.actorId()) && roleCode.equals(event.roleCode());
            }
        }

        private static final class RevocationRace {

            private final Integer superAdminId;
            private final Integer adminId;
            private final CountDownLatch superAdminChangeApplied = new CountDownLatch(1);
            private final CountDownLatch allowSuperAdminCommit = new CountDownLatch(1);
            private final CountDownLatch adminRequestAuthenticated = new CountDownLatch(1);
            private final CountDownLatch allowAdminRequestToContinue = new CountDownLatch(1);

            private RevocationRace(Integer superAdminId, Integer adminId) {
                this.superAdminId = superAdminId;
                this.adminId = adminId;
            }

            private boolean isSuperAdminRevokingRoleUpdate(RolePermissionAuditEvent event) {
                return superAdminId.equals(event.actorId())
                        && "ROLE_ADMIN".equals(event.roleCode())
                        && event.removedPermissions().contains("role:update");
            }

            private boolean isAdminRequest(CustomUserPrincipal principal) {
                return adminId.equals(principal.getAccountId())
                        && "ROLE_ADMIN".equals(principal.getRoleCode());
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
