package sparkminds.librarymanagement.auth.security;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EffectivePermissionService {

    public static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final PermissionRepository permissionRepository;

    public List<String> resolve(Account account) {
        return resolve(account.getRole());
    }

    public List<String> resolve(Role role) {
        if (ROLE_SUPER_ADMIN.equals(role.getCode())) {
            return allPermissionCodes();
        }
        return role.getPermissions().stream()
                .map(Permission::getCode)
                .sorted()
                .toList();
    }

    public List<String> resolveCurrentRoleCode(String roleCode) {
        if (ROLE_SUPER_ADMIN.equals(roleCode)) {
            return allPermissionCodes();
        }
        return permissionRepository.findPermissionCodesByRoleCode(roleCode);
    }

    public List<String> allPermissionCodes() {
        return permissionRepository.findAllByOrderByCodeAsc().stream()
                .map(Permission::getCode)
                .toList();
    }
}
