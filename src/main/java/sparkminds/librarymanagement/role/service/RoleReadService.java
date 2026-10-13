package sparkminds.librarymanagement.role.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.security.EffectivePermissionService;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.role.dto.PermissionCatalogResponse;
import sparkminds.librarymanagement.role.dto.RolePermissionsResponse;
import sparkminds.librarymanagement.role.dto.RoleSummaryResponse;
import sparkminds.librarymanagement.role.policy.PermissionDependencyRegistry;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleReadService {

    private final RoleRepositoy roleRepository;
    private final PermissionRepository permissionRepository;
    private final EffectivePermissionService effectivePermissionService;
    private final RoleAccessPolicy roleAccessPolicy;
    private final PermissionDependencyRegistry permissionDependencyRegistry;

    @Transactional(readOnly = true)
    public List<RoleSummaryResponse> getRoles(CustomUserPrincipal actor) {
        ensureRoleManagementRank(actor);
        Collection<String> actorPermissions = permissionCodes(actor);
        return roleRepository.findAll().stream()
                .filter(role -> roleAccessPolicy.canReadTarget(actor.getRoleCode(), role.getCode()))
                .sorted((left, right) -> left.getCode().compareTo(right.getCode()))
                .map(role -> new RoleSummaryResponse(
                        role.getCode(),
                        role.getDescription(),
                        role.getVersion(),
                        roleAccessPolicy.canEditTarget(actor.getRoleCode(), role.getCode(), actorPermissions)
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PermissionCatalogResponse> getPermissionCatalog(CustomUserPrincipal actor) {
        ensureRoleManagementRank(actor);
        Set<String> actorPermissions = permissionCodes(actor);
        List<Permission> permissions = permissionRepository.findAllByOrderByCodeAsc();
        permissionDependencyRegistry.validateCatalog(
                permissions.stream().map(Permission::getCode).toList());
        return permissions.stream()
                .map(permission -> new PermissionCatalogResponse(
                        permission.getCode(),
                        permission.getDescription(),
                        actorPermissions.contains(permission.getCode()),
                        permissionDependencyRegistry.directDependencies(permission.getCode()).stream().sorted().toList()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public RolePermissionsResponse getRolePermissions(CustomUserPrincipal actor, String roleCode) {
        ensureRoleManagementRank(actor);
        Role role = roleRepository.findByCode(roleCode)
                .filter(value -> roleAccessPolicy.canReadTarget(actor.getRoleCode(), value.getCode()))
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "ROLE_NOT_FOUND",
                        "Không tìm thấy vai trò"
                ));

        Set<String> actorPermissions = permissionCodes(actor);
        List<String> effectivePermissions = effectivePermissionService.resolve(role);
        List<String> assignedPermissions = RoleAccessPolicy.SUPER_ADMIN.equals(role.getCode())
                ? effectivePermissions
                : role.getPermissions().stream().map(Permission::getCode).sorted().toList();
        boolean editable = roleAccessPolicy.canEditTarget(actor.getRoleCode(), role.getCode(), actorPermissions);
        List<String> editablePermissions = editable
                ? roleAccessPolicy.editablePermissions(
                        actor.getRoleCode(),
                        role.getCode(),
                        actorPermissions,
                        effectivePermissionService.allPermissionCodes())
                : List.of();

        return new RolePermissionsResponse(
                role.getCode(),
                role.getVersion(),
                assignedPermissions,
                effectivePermissions,
                editablePermissions,
                editable
        );
    }

    private void ensureRoleManagementRank(CustomUserPrincipal actor) {
        if (!roleAccessPolicy.canReadRoleManagement(actor.getRoleCode())
                || !permissionCodes(actor).contains(RoleAccessPolicy.ROLE_READ)) {
            throw new AccessDeniedException("Role Management không dành cho vai trò này");
        }
    }

    private static Set<String> permissionCodes(CustomUserPrincipal actor) {
        return actor.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toUnmodifiableSet());
    }
}
