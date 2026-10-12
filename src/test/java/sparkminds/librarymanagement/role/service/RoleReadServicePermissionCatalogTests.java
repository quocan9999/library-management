package sparkminds.librarymanagement.role.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.security.EffectivePermissionService;
import sparkminds.librarymanagement.role.dto.PermissionCatalogResponse;
import sparkminds.librarymanagement.role.policy.PermissionDependencyRegistry;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoleReadServicePermissionCatalogTests {

    @Mock private RoleRepositoy roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private EffectivePermissionService effectivePermissionService;
    @Mock private RoleAccessPolicy roleAccessPolicy;

    @Test
    void permissionCatalogReturnsOnlyExplicitDependencies() {
        PermissionDependencyRegistry registry = new PermissionDependencyRegistry();
        RoleReadService service = new RoleReadService(
                roleRepository, permissionRepository, effectivePermissionService, roleAccessPolicy, registry);
        Role role = new Role();
        role.setCode("ROLE_ADMIN");
        Account account = new Account();
        account.setId(5);
        account.setUsername("admin");
        account.setRole(role);
        CustomUserPrincipal actor = CustomUserPrincipal.from(account, List.of("role:read", "member:read"));

        when(roleAccessPolicy.canReadRoleManagement("ROLE_ADMIN")).thenReturn(true);
        when(permissionRepository.findAllByOrderByCodeAsc()).thenReturn(catalogPermissions());

        List<PermissionCatalogResponse> response = service.getPermissionCatalog(actor);

        assertThat(response).filteredOn(permission -> "member:status:update".equals(permission.code()))
                .singleElement().extracting(PermissionCatalogResponse::dependencies)
                .isEqualTo(List.of("member:read"));
        assertThat(response).filteredOn(permission -> "borrow:create".equals(permission.code()))
                .singleElement().extracting(PermissionCatalogResponse::dependencies)
                .isEqualTo(List.of());
    }

    private static List<Permission> catalogPermissions() {
        return List.of(
                "member:read", "member:create", "member:update", "member:delete", "member:status:update",
                "book:read", "book:create", "book:update", "book:delete", "book:import",
                "role:read", "role:update", "borrow:create", "account:change-email"
        ).stream().map(code -> {
            Permission permission = new Permission();
            permission.setCode(code);
            return permission;
        }).toList();
    }
}
