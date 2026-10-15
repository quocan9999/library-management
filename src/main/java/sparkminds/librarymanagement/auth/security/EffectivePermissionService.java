package sparkminds.librarymanagement.auth.security;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EffectivePermissionService {

    private final RoleRepositoy roleRepository;
    private final PermissionRepository permissionRepository;

    public List<String> resolve(Account account) {
        return resolve(account.getRole());
    }

    public List<String> resolve(Role role) {
        if (!role.isEnabled()) {
            return List.of();
        }
        if (RoleAccessPolicy.ADMIN.equals(role.getCode())) {
            return allPermissionCodes();
        }
        return role.getPermissions().stream()
                .map(Permission::getCode)
                .sorted()
                .toList();
    }

    public List<String> resolveCurrentRoleCode(String roleCode) {
        Role role = roleRepository.findByCode(roleCode).orElse(null);
        if (role == null || !role.isEnabled()) {
            return List.of();
        }
        if (RoleAccessPolicy.ADMIN.equals(role.getCode())) {
            return allPermissionCodes();
        }
        return permissionRepository.findPermissionCodesByRoleCode(roleCode);
    }

    public List<String> resolveAssignedRoleCode(String roleCode) {
        return permissionRepository.findPermissionCodesByRoleCode(roleCode);
    }

    public List<String> allPermissionCodes() {
        return permissionRepository.findAllByOrderByCodeAsc().stream()
                .map(Permission::getCode)
                .toList();
    }
}
