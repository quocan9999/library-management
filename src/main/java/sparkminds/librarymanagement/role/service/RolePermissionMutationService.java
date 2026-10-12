package sparkminds.librarymanagement.role.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
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
import sparkminds.librarymanagement.role.dto.RolePermissionsResponse;
import sparkminds.librarymanagement.role.policy.PermissionDependencyRegistry;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

@Service
public class RolePermissionMutationService {

    private static final int MAX_PERMISSION_CODES_PER_DELTA = 100;

    private final AccountRepository accountRepository;
    private final RoleRepositoy roleRepository;
    private final PermissionRepository permissionRepository;
    private final EffectivePermissionService effectivePermissionService;
    private final RoleAccessPolicy roleAccessPolicy;
    private final PermissionDependencyRegistry permissionDependencyRegistry;
    private final JdbcTemplate jdbcTemplate;
    private final EntityManager entityManager;
    private final ApplicationEventPublisher eventPublisher;

    public RolePermissionMutationService(
            AccountRepository accountRepository,
            RoleRepositoy roleRepository,
            PermissionRepository permissionRepository,
            EffectivePermissionService effectivePermissionService,
            RoleAccessPolicy roleAccessPolicy,
            PermissionDependencyRegistry permissionDependencyRegistry,
            JdbcTemplate jdbcTemplate,
            EntityManager entityManager,
            ApplicationEventPublisher eventPublisher
    ) {
        this.accountRepository = accountRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.effectivePermissionService = effectivePermissionService;
        this.roleAccessPolicy = roleAccessPolicy;
        this.permissionDependencyRegistry = permissionDependencyRegistry;
        this.jdbcTemplate = jdbcTemplate;
        this.entityManager = entityManager;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public RolePermissionsResponse updatePermissions(
            CustomUserPrincipal requestActor,
            String targetRoleCode,
            RolePermissionUpdateRequest request
    ) {
        ValidatedDelta delta = validate(request);
        Account actorAccount = accountRepository.findByIdForUpdate(requestActor.getAccountId())
                .orElseThrow(() -> new AccessDeniedException("Tài khoản không còn khả dụng"));
        entityManager.refresh(actorAccount, LockModeType.PESSIMISTIC_WRITE);

        if (!actorAccount.isEnabled()) {
            throw new AccessDeniedException("Tài khoản không còn khả dụng");
        }

        String actorRoleCode = accountRepository.findRoleCodeByAccountId(actorAccount.getId())
                .orElseThrow(() -> new AccessDeniedException("Vai trò hiện hành không còn khả dụng"));
        if (!roleAccessPolicy.canReadTarget(actorRoleCode, targetRoleCode)) {
            throw roleNotFound();
        }

        Map<String, Role> lockedRoles = lockRolesInStableOrder(actorRoleCode, targetRoleCode);
        Role actorRole = lockedRoles.get(actorRoleCode);
        Role targetRole = lockedRoles.get(targetRoleCode);
        if (targetRole == null) {
            throw roleNotFound();
        }
        if (actorRole == null) {
            throw new AccessDeniedException("Vai trò hiện hành không còn khả dụng");
        }

        Set<String> actorPermissions = new HashSet<>(
                effectivePermissionService.resolveCurrentRoleCode(actorRoleCode));
        if (!actorPermissions.contains(RoleAccessPolicy.ROLE_READ)
                || !actorPermissions.contains(RoleAccessPolicy.ROLE_UPDATE)
                || !roleAccessPolicy.canEditTarget(actorRoleCode, targetRoleCode, actorPermissions)) {
            throw new AccessDeniedException("Không được phép cập nhật vai trò này");
        }

        if (targetRole.getVersion() != delta.expectedVersion()) {
            throw versionConflict();
        }

        List<String> catalogCodes = effectivePermissionService.allPermissionCodes();
        permissionDependencyRegistry.validateCatalog(catalogCodes);
        Set<String> requestedCodes = new HashSet<>(delta.addPermissions());
        requestedCodes.addAll(delta.removePermissions());
        Set<String> catalogCodeSet = new HashSet<>(catalogCodes);
        if (!catalogCodeSet.containsAll(requestedCodes)) {
            throw invalidDelta("Danh mục chứa mã quyền không tồn tại");
        }

        List<String> editableCodes = roleAccessPolicy.editablePermissions(
                actorRoleCode, targetRoleCode, actorPermissions, catalogCodes);
        Set<String> editableSet = new HashSet<>(editableCodes);
        if (!editableSet.containsAll(requestedCodes)) {
            throw new AccessDeniedException("Không được phép cấp hoặc thu hồi một số quyền được yêu cầu");
        }

        List<String> assignedCodes = effectivePermissionService.resolveCurrentRoleCode(targetRoleCode);
        Set<String> assignedSet = new HashSet<>(assignedCodes);
        Set<String> requiredPermissions = permissionDependencyRegistry.requiredPermissionsFor(delta.addPermissions());
        List<String> unassignableDependencies = requiredPermissions.stream()
                .filter(code -> !assignedSet.contains(code) && !editableSet.contains(code))
                .sorted()
                .toList();
        if (!unassignableDependencies.isEmpty()) {
            throw new AccessDeniedException("Không được phép cấp quyền phụ thuộc bắt buộc: "
                    + String.join(", ", unassignableDependencies));
        }

        Set<String> finalPermissions = new HashSet<>(assignedSet);
        finalPermissions.addAll(delta.addPermissions());
        finalPermissions.addAll(requiredPermissions);
        finalPermissions.removeAll(delta.removePermissions());
        Map<String, Set<String>> missingDependencies = permissionDependencyRegistry.missingDependencies(finalPermissions);
        if (!missingDependencies.isEmpty()) {
            throw dependencyConflict(missingDependencies);
        }

        List<String> permissionsToAdd = finalPermissions.stream()
                .filter(code -> !assignedSet.contains(code))
                .sorted()
                .toList();
        List<String> permissionsToRemove = assignedSet.stream()
                .filter(code -> !finalPermissions.contains(code))
                .sorted()
                .toList();

        if (!permissionsToAdd.isEmpty() || !permissionsToRemove.isEmpty()) {
            applyPermissionDelta(targetRole, permissionsToAdd, permissionsToRemove);
            incrementVersion(targetRole);
            eventPublisher.publishEvent(new RolePermissionAuditEvent(
                    actorAccount.getId(),
                    targetRoleCode,
                    permissionsToAdd,
                    permissionsToRemove,
                    Instant.now()
            ));
        }

        List<String> updatedPermissions = effectivePermissionService.resolveCurrentRoleCode(targetRoleCode);
        long currentVersion = jdbcTemplate.queryForObject(
                "SELECT version FROM roles WHERE id = ?", Long.class, targetRole.getId());
        List<String> updatedEditableCodes = roleAccessPolicy.editablePermissions(
                actorRoleCode, targetRoleCode, actorPermissions, catalogCodes);

        return new RolePermissionsResponse(
                targetRoleCode,
                currentVersion,
                updatedPermissions,
                updatedPermissions,
                updatedEditableCodes,
                true
        );
    }

    private Map<String, Role> lockRolesInStableOrder(String actorRoleCode, String targetRoleCode) {
        Map<String, Role> roles = new LinkedHashMap<>();
        List<String> lockOrder = Stream.of(actorRoleCode, targetRoleCode)
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();

        // Every role update locks the actor and target rows by code order to avoid opposite lock cycles.
        for (String roleCode : lockOrder) {
            Role role = roleRepository.findByCodeForUpdate(roleCode).orElse(null);
            if (role != null) {
                // OSIV may have loaded this Role during bearer authentication; refresh the locked row.
                entityManager.refresh(role, LockModeType.PESSIMISTIC_WRITE);
                roles.put(roleCode, role);
            }
        }
        return roles;
    }

    private void applyPermissionDelta(
            Role targetRole,
            List<String> permissionsToAdd,
            List<String> permissionsToRemove
    ) {
        Set<String> requested = Stream.concat(permissionsToAdd.stream(), permissionsToRemove.stream())
                .collect(java.util.stream.Collectors.toSet());
        Map<String, Permission> permissionsByCode = new HashMap<>();
        permissionRepository.findAllByCodeIn(requested)
                .forEach(permission -> permissionsByCode.put(permission.getCode(), permission));

        for (String code : permissionsToRemove) {
            Permission permission = permissionsByCode.get(code);
            int deleted = jdbcTemplate.update(
                    "DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?",
                    targetRole.getId(), permission.getId());
            if (deleted != 1) {
                throw versionConflict();
            }
        }
        for (String code : permissionsToAdd) {
            Permission permission = permissionsByCode.get(code);
            int inserted = jdbcTemplate.update(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                    targetRole.getId(), permission.getId());
            if (inserted != 1) {
                throw versionConflict();
            }
        }
    }

    private void incrementVersion(Role targetRole) {
        int updated = jdbcTemplate.update(
                "UPDATE roles SET version = version + 1 WHERE id = ? AND version = ?",
                targetRole.getId(), targetRole.getVersion());
        if (updated != 1) {
            throw versionConflict();
        }
        // The SQL compare-and-set is serialized by the role lock; refresh the @Version field
        // before returning it or allowing any later JPA update in this transaction.
        entityManager.refresh(targetRole, LockModeType.PESSIMISTIC_WRITE);
    }

    private static ValidatedDelta validate(RolePermissionUpdateRequest request) {
        if (request == null || request.expectedVersion() == null
                || request.addPermissions() == null || request.removePermissions() == null) {
            throw invalidDelta("expectedVersion và cả hai danh sách quyền là bắt buộc");
        }

        JsonNode expectedVersionNode = request.expectedVersion();
        if (!expectedVersionNode.isIntegralNumber() || !expectedVersionNode.canConvertToLong()) {
            throw invalidDelta("expectedVersion phải là số nguyên không âm");
        }
        long expectedVersion = expectedVersionNode.longValue();
        if (expectedVersion < 0) {
            throw invalidDelta("expectedVersion phải là số nguyên không âm");
        }

        List<String> additions = new ArrayList<>(request.addPermissions());
        List<String> removals = new ArrayList<>(request.removePermissions());
        if (additions.size() + removals.size() > MAX_PERMISSION_CODES_PER_DELTA) {
            throw invalidDelta("Delta vượt quá giới hạn số quyền");
        }
        if (!hasUniqueNonBlankValues(additions) || !hasUniqueNonBlankValues(removals)) {
            throw invalidDelta("Mã quyền không được rỗng hoặc lặp lại");
        }
        Set<String> overlap = new HashSet<>(additions);
        overlap.retainAll(removals);
        if (!overlap.isEmpty()) {
            throw invalidDelta("Không thể vừa cấp vừa thu hồi cùng một quyền");
        }
        return new ValidatedDelta(expectedVersion, List.copyOf(additions), List.copyOf(removals));
    }

    private static boolean hasUniqueNonBlankValues(Collection<String> values) {
        Set<String> seen = new HashSet<>();
        for (String value : values) {
            if (value == null || value.isBlank() || !seen.add(value)) {
                return false;
            }
        }
        return true;
    }

    private static BusinessException invalidDelta(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_PERMISSION_DELTA_INVALID", message);
    }

    private static BusinessException dependencyConflict(Map<String, Set<String>> missingDependencies) {
        String details = missingDependencies.entrySet().stream()
                .map(entry -> entry.getValue().stream()
                        .map(dependency -> "quyền cơ sở " + dependency + " đang được quyền " + entry.getKey()
                                + " phụ thuộc")
                        .sorted()
                        .collect(java.util.stream.Collectors.joining("; ")))
                .collect(java.util.stream.Collectors.joining("; "));
        return new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_PERMISSION_DEPENDENCY_CONFLICT",
                "Không thể thu hồi quyền cơ sở khi vẫn còn quyền phụ thuộc: " + details
                        + ". Hãy thu hồi các quyền phụ thuộc trong cùng yêu cầu.");
    }

    private static BusinessException versionConflict() {
        return new BusinessException(HttpStatus.CONFLICT, "ROLE_VERSION_CONFLICT",
                "Vai trò đã được cập nhật; hãy tải lại dữ liệu");
    }

    private static BusinessException roleNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");
    }

    private record ValidatedDelta(long expectedVersion, List<String> addPermissions, List<String> removePermissions) {
    }
}
