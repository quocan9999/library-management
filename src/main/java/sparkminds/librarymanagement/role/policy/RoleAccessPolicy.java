package sparkminds.librarymanagement.role.policy;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Set;

@Component
public class RoleAccessPolicy {

    public static final String ADMIN = "ADMIN";
    public static final String USER = "USER";
    public static final String ROLE_READ = "role:read";
    public static final String ROLE_UPDATE = "role:update";

    private static final Set<String> SELF_SERVICE_ACCOUNT_PERMISSIONS = Set.of(
            "account:change-password", "account:change-email");

    private static final List<String> USER_ASSIGNABLE_PERMISSION_CODES = List.of(
            "book:read", "book:create", "book:update", "book:delete", "book:import",
            "member:read", "member:create", "member:update", "member:delete",
            "borrow:create", "borrow:return", "borrow:read-own", "borrow:cancel-own", "borrow:renew",
            "account:change-password", "account:change-email"
    );

    public boolean canReadRoleManagement(String actorRoleCode) {
        return ADMIN.equals(actorRoleCode);
    }

    public boolean canReadTarget(String actorRoleCode, String targetRoleCode) {
        return ADMIN.equals(actorRoleCode) && targetRoleCode != null;
    }

    public boolean canEditTarget(
            String actorRoleCode,
            String targetRoleCode,
            Collection<String> actorPermissions
    ) {
        return ADMIN.equals(actorRoleCode)
                && targetRoleCode != null
                && !ADMIN.equals(targetRoleCode)
                && !"SUPER_ADMIN".equals(targetRoleCode)
                && actorPermissions.contains(ROLE_UPDATE);
    }

    public List<String> editablePermissions(
            String actorRoleCode,
            String targetRoleCode,
            Collection<String> actorPermissions,
            Collection<String> catalogCodes
    ) {
        if (!canEditTarget(actorRoleCode, targetRoleCode, actorPermissions)) {
            return List.of();
        }

        return catalogCodes.stream()
                .filter(code -> USER.equals(targetRoleCode)
                        ? USER_ASSIGNABLE_PERMISSION_CODES.contains(code)
                        : isAssignableToNonAdminRole(code))
                .filter(actorPermissions::contains)
                .sorted()
                .toList();
    }

    public boolean isAssignableToNonAdminRole(String permissionCode) {
        if (permissionCode == null || permissionCode.startsWith("role:")) {
            return false;
        }
        return !permissionCode.startsWith("account:")
                || SELF_SERVICE_ACCOUNT_PERMISSIONS.contains(permissionCode);
    }
}
