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
import sparkminds.librarymanagement.role.dto.RoleDetailResponse;
import sparkminds.librarymanagement.role.dto.PermissionCatalogResponse;
import sparkminds.librarymanagement.role.dto.RolePermissionsResponse;
import sparkminds.librarymanagement.role.dto.RoleSearchItemResponse;
import sparkminds.librarymanagement.role.dto.RoleSearchResponse;
import sparkminds.librarymanagement.role.dto.RoleSummaryResponse;
import sparkminds.librarymanagement.role.policy.PermissionDependencyRegistry;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;
import sparkminds.librarymanagement.role.repository.RoleManagementReadRepository;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleReadService {

    private static final int MAX_SEARCH_PAGE = 10_000;
    private static final int MAX_SEARCH_SIZE = 100;

    private final RoleRepositoy roleRepository;
    private final PermissionRepository permissionRepository;
    private final EffectivePermissionService effectivePermissionService;
    private final RoleAccessPolicy roleAccessPolicy;
    private final PermissionDependencyRegistry permissionDependencyRegistry;
    private final RoleManagementReadRepository roleManagementReadRepository;

    @Transactional(readOnly = true)
    public List<RoleSummaryResponse> getRoles(CustomUserPrincipal actor) {
        ensureRoleManagementRank(actor);
        Collection<String> actorPermissions = permissionCodes(actor);
        return roleRepository.findAll().stream()
                .filter(role -> roleAccessPolicy.canReadTarget(actor.getRoleCode(), role.getCode()))
                .sorted((left, right) -> left.getCode().compareTo(right.getCode()))
                .map(role -> new RoleSummaryResponse(
                        role.getCode(),
                        role.getDisplayName(),
                        role.getDescription(),
                        role.isEnabled(),
                        role.getVersion(),
                        role.isEnabled()
                                && roleAccessPolicy.canEditTarget(actor.getRoleCode(), role.getCode(), actorPermissions)
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public RoleSearchResponse searchRoles(
            CustomUserPrincipal actor,
            String query,
            String status,
            Integer page,
            Integer size,
            String sort,
            String direction
    ) {
        ensureRoleManagementRank(actor);
        int requestedPage = page == null ? 0 : page;
        int requestedSize = size == null ? 10 : size;
        if (requestedPage < 0 || requestedPage > MAX_SEARCH_PAGE
                || requestedSize < 1 || requestedSize > MAX_SEARCH_SIZE
                || (query != null && query.length() > 100)) {
            throw roleSearchInvalid();
        }

        Boolean enabled = null;
        if (status != null && !status.isBlank()) {
            enabled = switch (status.trim().toUpperCase(java.util.Locale.ROOT)) {
                case "ACTIVE" -> true;
                case "INACTIVE" -> false;
                default -> throw roleSearchInvalid();
            };
        }

        String requestedSort = sort == null || sort.isBlank() ? "code" : sort;
        if (!List.of("code", "displayName", "createdAt", "accountCount", "permissionCount", "enabled")
                .contains(requestedSort)) {
            throw roleSearchInvalid();
        }
        String requestedDirection = direction == null || direction.isBlank()
                ? "ASC" : direction.trim().toUpperCase(java.util.Locale.ROOT);
        if (!List.of("ASC", "DESC").contains(requestedDirection)) {
            throw roleSearchInvalid();
        }

        Collection<String> actorPermissions = permissionCodes(actor);
        List<RoleSearchItemResponse> content = roleManagementReadRepository.search(
                        query, enabled, requestedPage, requestedSize, requestedSort, requestedDirection).stream()
                .map(row -> new RoleSearchItemResponse(
                        row.code(), row.displayName(), row.description(), row.enabled(), row.version(),
                        isSystemRole(row.code()), row.accountCount(), row.permissionCount(), row.createdAt(),
                        row.enabled() && roleAccessPolicy.canEditTarget(actor.getRoleCode(), row.code(), actorPermissions)
                ))
                .toList();
        long totalElements = roleManagementReadRepository.count(query, enabled);
        return RoleSearchResponse.of(content, requestedPage, requestedSize, totalElements);
    }

    @Transactional(readOnly = true)
    public RoleDetailResponse getRole(CustomUserPrincipal actor, String roleCode) {
        ensureRoleManagementRank(actor);
        RoleManagementReadRepository.RoleReadRow role = roleManagementReadRepository.findByCode(roleCode);
        if (role == null) {
            throw roleNotFound();
        }
        return toDetailResponse(role);
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
                        permissionDomain(permission.getCode()),
                        permission.getDescription(),
                        actorPermissions.contains(permission.getCode())
                                && roleAccessPolicy.isAssignableToNonAdminRole(permission.getCode()),
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
        List<String> assignedPermissions = role.getPermissions().stream()
                .map(Permission::getCode)
                .sorted()
                .toList();
        boolean editable = role.isEnabled()
                && roleAccessPolicy.canEditTarget(actor.getRoleCode(), role.getCode(), actorPermissions);
        List<String> editablePermissions = editable
                ? roleAccessPolicy.editablePermissions(
                        actor.getRoleCode(),
                        role.getCode(),
                        actorPermissions,
                        effectivePermissionService.allPermissionCodes())
                : List.of();

        return new RolePermissionsResponse(
                role.getCode(),
                role.getDisplayName(),
                role.getVersion(),
                role.isEnabled(),
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

    private static RoleDetailResponse toDetailResponse(RoleManagementReadRepository.RoleReadRow role) {
        boolean systemRole = isSystemRole(role.code());
        return new RoleDetailResponse(
                role.code(), role.displayName(), role.description(), role.enabled(), role.version(),
                systemRole, "ADMIN".equals(role.code()), role.accountCount(), role.permissionCount(), role.createdAt());
    }

    private static boolean isSystemRole(String roleCode) {
        return "ADMIN".equals(roleCode) || "USER".equals(roleCode);
    }

    private static String permissionDomain(String permissionCode) {
        int separator = permissionCode.indexOf(':');
        return separator > 0 ? permissionCode.substring(0, separator) : "general";
    }

    private static BusinessException roleSearchInvalid() {
        return new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_SEARCH_INVALID",
                "Bộ lọc, phân trang hoặc sắp xếp vai trò không hợp lệ");
    }

    private static BusinessException roleNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");
    }
}
