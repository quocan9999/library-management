package sparkminds.librarymanagement.role.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
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
import sparkminds.librarymanagement.role.dto.RoleCreateRequest;
import sparkminds.librarymanagement.role.dto.RoleDetailResponse;
import sparkminds.librarymanagement.role.dto.RoleMetadataUpdateRequest;
import sparkminds.librarymanagement.role.dto.RoleStatusUpdateRequest;
import sparkminds.librarymanagement.role.policy.PermissionDependencyRegistry;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class RoleManagementService {

    private static final int MAX_PERMISSION_CODES = 100;

    private final AccountRepository accountRepository;
    private final RoleRepositoy roleRepository;
    private final PermissionRepository permissionRepository;
    private final EffectivePermissionService effectivePermissionService;
    private final PermissionDependencyRegistry permissionDependencyRegistry;
    private final RoleAccessPolicy roleAccessPolicy;
    private final EntityManager entityManager;
    private final RoleReadService roleReadService;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public RoleDetailResponse createRole(CustomUserPrincipal requestActor, RoleCreateRequest request) {
        MutationActor actor = lockActor(requestActor);
        ensureRoleManager(actor);
        validateRoleCode(request.code());
        if (roleRepository.existsByCodeIgnoreCase(request.code())) {
            throw new BusinessException(HttpStatus.CONFLICT, "ROLE_CODE_DUPLICATED", "Mã vai trò đã tồn tại");
        }

        List<String> requestedCodes = validatePermissionCodes(request.permissions());
        List<String> catalogCodes = effectivePermissionService.allPermissionCodes();
        permissionDependencyRegistry.validateCatalog(catalogCodes);
        Set<String> catalog = new HashSet<>(catalogCodes);
        if (!catalog.containsAll(requestedCodes)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_PERMISSION_UNKNOWN",
                    "Danh sách chứa mã quyền không có trong danh mục");
        }
        if (requestedCodes.stream().anyMatch(code -> !roleAccessPolicy.isAssignableToNonAdminRole(code))) {
            throw new AccessDeniedException("Không thể cấp quyền quản trị cho nhóm thường");
        }

        Set<String> permissionsToGrant = new LinkedHashSet<>(requestedCodes);
        permissionsToGrant.addAll(permissionDependencyRegistry.requiredPermissionsFor(requestedCodes));
        if (permissionsToGrant.isEmpty() || !catalog.containsAll(permissionsToGrant)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_PERMISSION_UNKNOWN",
                    "Tập quyền cuối cùng không hợp lệ");
        }
        if (permissionsToGrant.stream().anyMatch(code -> !roleAccessPolicy.isAssignableToNonAdminRole(code))) {
            throw new AccessDeniedException("Không thể cấp quyền quản trị bắt buộc cho nhóm thường");
        }

        Map<String, Permission> permissionsByCode = new HashMap<>();
        permissionRepository.findAllByCodeIn(permissionsToGrant)
                .forEach(permission -> permissionsByCode.put(permission.getCode(), permission));
        if (permissionsByCode.size() != permissionsToGrant.size()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_PERMISSION_UNKNOWN",
                    "Danh sách chứa mã quyền không có trong danh mục");
        }

        Role role = new Role();
        role.setCode(request.code());
        role.setDisplayName(request.displayName().trim());
        role.setDescription(request.description());
        role.setEnabled(true);
        permissionsToGrant.stream().sorted().map(permissionsByCode::get).forEach(role.getPermissions()::add);
        try {
            roleRepository.saveAndFlush(role);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(HttpStatus.CONFLICT, "ROLE_CODE_DUPLICATED", "Mã vai trò đã tồn tại");
        }
        return roleReadService.getRole(requestActor, role.getCode());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public RoleDetailResponse updateMetadata(
            CustomUserPrincipal requestActor,
            String roleCode,
            RoleMetadataUpdateRequest request
    ) {
        LockedTarget locked = lockTarget(requestActor, roleCode);
        ensureRoleManager(locked.actor());
        ensureMutableRole(locked.role());
        ensureVersion(locked.role(), request.expectedVersion());
        ensureActive(locked.role());

        String displayName = request.displayName().trim();
        if (displayName.equals(locked.role().getDisplayName())
                && java.util.Objects.equals(request.description(), locked.role().getDescription())) {
            return roleReadService.getRole(requestActor, roleCode);
        }

        locked.role().setDisplayName(displayName);
        locked.role().setDescription(request.description());
        roleRepository.saveAndFlush(locked.role());
        return roleReadService.getRole(requestActor, roleCode);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public RoleDetailResponse updateStatus(
            CustomUserPrincipal requestActor,
            String roleCode,
            RoleStatusUpdateRequest request
    ) {
        LockedTarget locked = lockTarget(requestActor, roleCode);
        ensureRoleManager(locked.actor());
        ensureStatusMutableRole(locked.role());
        ensureVersion(locked.role(), request.expectedVersion());

        if (!locked.role().isEnabled() && !request.enabled()) {
            throw roleInactive();
        }
        if (locked.role().isEnabled() == request.enabled()) {
            return roleReadService.getRole(requestActor, roleCode);
        }

        locked.role().setEnabled(request.enabled());
        roleRepository.saveAndFlush(locked.role());
        return roleReadService.getRole(requestActor, roleCode);
    }

    private MutationActor lockActor(CustomUserPrincipal requestActor) {
        Account account = accountRepository.findByIdForUpdate(requestActor.getAccountId())
                .orElseThrow(() -> new AccessDeniedException("Tài khoản không còn khả dụng"));
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        if (!account.isEnabled()) {
            throw new AccessDeniedException("Tài khoản không còn khả dụng");
        }

        String roleCode = accountRepository.findRoleCodeByAccountId(account.getId())
                .orElseThrow(() -> new AccessDeniedException("Vai trò hiện hành không còn khả dụng"));
        Role role = roleRepository.findByCodeForUpdate(roleCode)
                .orElseThrow(() -> new AccessDeniedException("Vai trò hiện hành không còn khả dụng"));
        entityManager.refresh(role, LockModeType.PESSIMISTIC_WRITE);
        return new MutationActor(account, roleCode,
                new HashSet<>(effectivePermissionService.resolveCurrentRoleCode(roleCode)));
    }

    private LockedTarget lockTarget(CustomUserPrincipal requestActor, String targetRoleCode) {
        Account account = accountRepository.findByIdForUpdate(requestActor.getAccountId())
                .orElseThrow(() -> new AccessDeniedException("Tài khoản không còn khả dụng"));
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        if (!account.isEnabled()) {
            throw new AccessDeniedException("Tài khoản không còn khả dụng");
        }
        String actorRoleCode = accountRepository.findRoleCodeByAccountId(account.getId())
                .orElseThrow(() -> new AccessDeniedException("Vai trò hiện hành không còn khả dụng"));

        Map<String, Role> lockedRoles = new LinkedHashMap<>();
        List<String> lockOrder = Stream.of(actorRoleCode, targetRoleCode)
                .distinct().sorted(Comparator.naturalOrder()).toList();
        for (String code : lockOrder) {
            Role role = roleRepository.findByCodeForUpdate(code).orElse(null);
            if (role != null) {
                entityManager.refresh(role, LockModeType.PESSIMISTIC_WRITE);
                lockedRoles.put(code, role);
            }
        }
        Role actorRole = lockedRoles.get(actorRoleCode);
        Role targetRole = lockedRoles.get(targetRoleCode);
        if (actorRole == null || !roleAccessPolicy.canReadRoleManagement(actorRoleCode)) {
            throw new AccessDeniedException("Role Management chỉ dành cho ADMIN");
        }
        if (targetRole == null) {
            throw roleNotFound();
        }
        return new LockedTarget(new MutationActor(account, actorRoleCode,
                new HashSet<>(effectivePermissionService.resolveCurrentRoleCode(actorRoleCode))), targetRole);
    }

    private void ensureRoleManager(MutationActor actor) {
        if (!RoleAccessPolicy.ADMIN.equals(actor.roleCode())
                || !actor.permissions().contains(RoleAccessPolicy.ROLE_READ)
                || !actor.permissions().contains(RoleAccessPolicy.ROLE_UPDATE)) {
            throw new AccessDeniedException("Không được phép quản lý nhóm quyền");
        }
    }

    private static void ensureMutableRole(Role role) {
        if (RoleAccessPolicy.ADMIN.equals(role.getCode()) || "SUPER_ADMIN".equals(role.getCode())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "ROLE_SYSTEM_IMMUTABLE",
                    "Vai trò hệ thống không thể được sửa đổi tại chức năng này");
        }
    }

    private static void ensureStatusMutableRole(Role role) {
        if (RoleAccessPolicy.ADMIN.equals(role.getCode())
                || RoleAccessPolicy.USER.equals(role.getCode())
                || "SUPER_ADMIN".equals(role.getCode())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "ROLE_SYSTEM_IMMUTABLE",
                    "Vai trò hệ thống không thể được sửa đổi trạng thái");
        }
    }

    private static void ensureVersion(Role role, Long expectedVersion) {
        if (expectedVersion == null || expectedVersion < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_VERSION_INVALID",
                    "expectedVersion phải là số nguyên không âm");
        }
        if (role.getVersion() != expectedVersion) {
            throw versionConflict();
        }
    }

    private static void ensureActive(Role role) {
        if (!role.isEnabled()) {
            throw roleInactive();
        }
    }

    private static void validateRoleCode(String code) {
        if (code == null || !code.matches("^[A-Z][A-Z0-9_]{0,49}$") || code.startsWith("ROLE_")) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_CODE_INVALID",
                    "Mã vai trò phải dùng chữ hoa, số hoặc dấu gạch dưới và không có prefix ROLE_");
        }
        if (Set.of("ADMIN", "USER", "SUPER_ADMIN").contains(code)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_CODE_RESERVED",
                    "Mã vai trò hệ thống không thể được tạo lại");
        }
    }

    private static List<String> validatePermissionCodes(List<String> permissionCodes) {
        if (permissionCodes == null || permissionCodes.isEmpty() || permissionCodes.size() > MAX_PERMISSION_CODES) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_PERMISSION_DELTA_INVALID",
                    "Nhóm mới phải có từ một quyền hợp lệ trở lên");
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String code : permissionCodes) {
            if (code == null || code.isBlank() || !unique.add(code)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "ROLE_PERMISSION_DELTA_INVALID",
                        "Danh sách quyền không được rỗng hoặc trùng lặp");
            }
        }
        return new ArrayList<>(unique);
    }

    private static BusinessException roleNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");
    }

    private static BusinessException versionConflict() {
        return new BusinessException(HttpStatus.CONFLICT, "ROLE_VERSION_CONFLICT",
                "Vai trò đã được cập nhật; hãy tải lại dữ liệu");
    }

    private static BusinessException roleInactive() {
        return new BusinessException(HttpStatus.CONFLICT, "ROLE_INACTIVE",
                "Nhóm quyền đang Inactive; chỉ có thể kích hoạt lại nhóm");
    }

    private record MutationActor(Account account, String roleCode, Set<String> permissions) {
    }

    private record LockedTarget(MutationActor actor, Role role) {
    }
}
