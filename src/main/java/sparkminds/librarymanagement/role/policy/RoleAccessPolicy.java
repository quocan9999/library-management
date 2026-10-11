package sparkminds.librarymanagement.role.policy;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Set;

@Component
public class RoleAccessPolicy {

    public static final String SUPER_ADMIN = "ROLE_SUPER_ADMIN";
    public static final String ADMIN = "ROLE_ADMIN";
    public static final String USER = "ROLE_USER";
    public static final String ROLE_READ = "role:read";
    public static final String ROLE_UPDATE = "role:update";

    private static final Set<String> USER_ASSIGNABLE_PERMISSION_CODES = Set.of(
            "book:read",
            "book:create",
            "book:update",
            "book:delete",
            "book:import",
            "member:read",
            "member:create",
            "member:update",
            "member:delete",
            "borrow:create",
            "borrow:return",
            "account:change-password",
            "account:change-email"
    );

    public boolean canReadRoleManagement(String actorRoleCode) {
        return SUPER_ADMIN.equals(actorRoleCode) || ADMIN.equals(actorRoleCode);
    }

    public boolean canReadTarget(String actorRoleCode, String targetRoleCode) {
        if (SUPER_ADMIN.equals(actorRoleCode)) {
            return SUPER_ADMIN.equals(targetRoleCode) || ADMIN.equals(targetRoleCode) || USER.equals(targetRoleCode);
        }
        return ADMIN.equals(actorRoleCode) && (ADMIN.equals(targetRoleCode) || USER.equals(targetRoleCode));
    }

    public boolean canEditTarget(
            String actorRoleCode,
            String targetRoleCode,
            Collection<String> actorPermissions
    ) {
        if (!actorPermissions.contains(ROLE_UPDATE) || SUPER_ADMIN.equals(targetRoleCode)) {
            return false;
        }
        return SUPER_ADMIN.equals(actorRoleCode)
                && (ADMIN.equals(targetRoleCode) || USER.equals(targetRoleCode))
                || ADMIN.equals(actorRoleCode) && USER.equals(targetRoleCode);
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
                .filter(code -> {
                    if (ADMIN.equals(targetRoleCode)) {
                        return SUPER_ADMIN.equals(actorRoleCode);
                    }
                    if (!USER.equals(targetRoleCode) || !USER_ASSIGNABLE_PERMISSION_CODES.contains(code)) {
                        return false;
                    }
                    return SUPER_ADMIN.equals(actorRoleCode) || actorPermissions.contains(code);
                })
                .sorted()
                .toList();
    }
}
