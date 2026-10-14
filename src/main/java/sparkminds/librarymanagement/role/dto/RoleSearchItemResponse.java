package sparkminds.librarymanagement.role.dto;

import java.time.LocalDateTime;

public record RoleSearchItemResponse(
        String code,
        String displayName,
        String description,
        boolean enabled,
        long version,
        boolean systemRole,
        long accountCount,
        long permissionCount,
        LocalDateTime createdAt,
        boolean canEdit
) {
}
