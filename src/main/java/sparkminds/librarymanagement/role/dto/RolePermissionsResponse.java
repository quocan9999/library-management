package sparkminds.librarymanagement.role.dto;

import java.util.List;

public record RolePermissionsResponse(
        String roleCode,
        String displayName,
        long version,
        boolean enabled,
        List<String> assignedPermissions,
        List<String> effectivePermissions,
        List<String> editablePermissions,
        boolean editable
) {
}
