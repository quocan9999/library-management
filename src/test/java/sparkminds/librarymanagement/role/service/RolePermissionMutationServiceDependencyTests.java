package sparkminds.librarymanagement.role.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.security.EffectivePermissionService;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.role.dto.RolePermissionUpdateRequest;
import sparkminds.librarymanagement.role.policy.PermissionDependencyRegistry;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RolePermissionMutationServiceDependencyTests {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock private AccountRepository accountRepository;
    @Mock private RoleRepositoy roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private EffectivePermissionService effectivePermissionService;
    @Mock private RoleAccessPolicy roleAccessPolicy;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private EntityManager entityManager;
    @Mock private ApplicationEventPublisher eventPublisher;

    private RolePermissionMutationService service;
    private CustomUserPrincipal actor;
    private Account actorAccount;
    private Role actorRole;
    private Role targetRole;
    private Permission memberRead;
    private Permission memberCreate;

    @BeforeEach
    void setUp() {
        service = new RolePermissionMutationService(
                accountRepository,
                roleRepository,
                permissionRepository,
                effectivePermissionService,
                roleAccessPolicy,
                new PermissionDependencyRegistry(),
                jdbcTemplate,
                entityManager,
                eventPublisher
        );

        actorRole = role(1, "ROLE_ADMIN", 4);
        targetRole = role(2, "ROLE_USER", 7);
        actorAccount = new Account();
        actorAccount.setId(10);
        actorAccount.setUsername("admin");
        actorAccount.setPasswordHash("test-hash");
        actorAccount.setRole(actorRole);
        actorAccount.setEnabled(true);
        actor = CustomUserPrincipal.from(actorAccount,
                List.of("role:read", "role:update", "member:create", "member:read"));

        memberRead = permission(1, "member:read");
        memberCreate = permission(2, "member:create");

        when(accountRepository.findByIdForUpdate(10)).thenReturn(Optional.of(actorAccount));
        when(accountRepository.findRoleCodeByAccountId(10)).thenReturn(Optional.of("ROLE_ADMIN"));
        when(roleRepository.findByCodeForUpdate("ROLE_ADMIN")).thenReturn(Optional.of(actorRole));
        when(roleRepository.findByCodeForUpdate("ROLE_USER")).thenReturn(Optional.of(targetRole));
        when(roleAccessPolicy.canReadTarget("ROLE_ADMIN", "ROLE_USER")).thenReturn(true);
        when(roleAccessPolicy.canEditTarget(eq("ROLE_ADMIN"), eq("ROLE_USER"), any())).thenReturn(true);
        when(effectivePermissionService.resolveCurrentRoleCode("ROLE_ADMIN"))
                .thenReturn(List.of("role:read", "role:update", "member:create", "member:read"));
        when(effectivePermissionService.allPermissionCodes())
                .thenReturn(List.of(
                        "role:read", "role:update", "member:read", "member:create", "member:update",
                        "member:delete", "member:status:update", "book:read", "book:create", "book:update",
                        "book:delete", "book:import"));
        when(roleAccessPolicy.editablePermissions(eq("ROLE_ADMIN"), eq("ROLE_USER"), any(), any()))
                .thenReturn(List.of("member:read", "member:create"));
        when(permissionRepository.findAllByCodeIn(any()))
                .thenReturn(List.of(memberRead, memberCreate));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), any())).thenReturn(8L);
    }

    @Test
    void grantingOperationAlsoPersistsItsRequiredBasePermissionAndAuditsBoth() throws Exception {
        when(effectivePermissionService.resolveCurrentRoleCode("ROLE_USER"))
                .thenReturn(List.of(), List.of("member:create", "member:read"));

        service.updatePermissions(actor, "ROLE_USER", request(7, List.of("member:create"), List.of()));

        verify(jdbcTemplate).update(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", (short) 2, (short) 2);
        verify(jdbcTemplate).update(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", (short) 2, (short) 1);
        ArgumentCaptor<RolePermissionAuditEvent> event = ArgumentCaptor.forClass(RolePermissionAuditEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        org.assertj.core.api.Assertions.assertThat(event.getValue().addedPermissions())
                .containsExactly("member:create", "member:read");
    }

    @Test
    void actorCannotCauseAnUnassignableDependencyToBeGrantedPartially() throws Exception {
        when(roleAccessPolicy.editablePermissions(eq("ROLE_ADMIN"), eq("ROLE_USER"), any(), any()))
                .thenReturn(List.of("member:create"));
        when(effectivePermissionService.resolveCurrentRoleCode("ROLE_USER")).thenReturn(List.of());

        assertThatThrownBy(() -> service.updatePermissions(
                actor, "ROLE_USER", request(7, List.of("member:create"), List.of())))
                .isInstanceOf(AccessDeniedException.class);

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void basePermissionCannotBeRemovedWhileARegisteredDependentRemains() throws Exception {
        when(effectivePermissionService.resolveCurrentRoleCode("ROLE_USER"))
                .thenReturn(List.of("member:create", "member:read"));

        assertThatThrownBy(() -> service.updatePermissions(
                actor, "ROLE_USER", request(7, List.of(), List.of("member:read"))))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    org.assertj.core.api.Assertions.assertThat(businessException.getCode())
                            .isEqualTo("ROLE_PERMISSION_DEPENDENCY_CONFLICT");
                    org.assertj.core.api.Assertions.assertThat(businessException.getMessage())
                            .contains("member:create", "member:read");
                });

        verifyNoInteractions(jdbcTemplate);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void dependentAndBaseCanBeRemovedInTheSameDelta() throws Exception {
        when(effectivePermissionService.resolveCurrentRoleCode("ROLE_USER"))
                .thenReturn(List.of("member:create", "member:read"), List.of());

        service.updatePermissions(actor, "ROLE_USER",
                request(7, List.of(), List.of("member:create", "member:read")));

        verify(jdbcTemplate).update(
                "DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?", (short) 2, (short) 2);
        verify(jdbcTemplate).update(
                "DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?", (short) 2, (short) 1);
    }

    @Test
    void staleRoleVersionDoesNotApplyPermissionOrAuditChanges() throws Exception {
        assertThatThrownBy(() -> service.updatePermissions(
                actor, "ROLE_USER", request(6, List.of("member:create"), List.of())))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> org.assertj.core.api.Assertions.assertThat(
                        ((BusinessException) exception).getCode()).isEqualTo("ROLE_VERSION_CONFLICT"));

        verifyNoInteractions(jdbcTemplate);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void noOpPermissionDeltaDoesNotWriteOrAdvanceRoleVersion() throws Exception {
        when(effectivePermissionService.resolveCurrentRoleCode("ROLE_USER"))
                .thenReturn(List.of("member:read"), List.of("member:read"));

        service.updatePermissions(actor, "ROLE_USER", request(7, List.of("member:read"), List.of()));

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(eventPublisher);
    }

    private static Role role(int id, String code, long version) {
        Role role = new Role();
        role.setId((short) id);
        role.setCode(code);
        role.setVersion(version);
        return role;
    }

    private static Permission permission(int id, String code) {
        Permission permission = new Permission();
        permission.setId((short) id);
        permission.setCode(code);
        return permission;
    }

    private static RolePermissionUpdateRequest request(long version, List<String> add, List<String> remove)
            throws Exception {
        return new RolePermissionUpdateRequest(OBJECT_MAPPER.readTree(Long.toString(version)), add, remove);
    }
}
