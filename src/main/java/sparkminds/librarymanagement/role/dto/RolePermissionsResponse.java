package sparkminds.librarymanagement.role.dto;

import java.util.List;

public record RolePermissionsResponse(
        String roleCode,
        long version,
        List<String> assignedPermissions,
        List<String> effectivePermissions,
        List<String> editablePermissions,
        boolean editable
) {
}
