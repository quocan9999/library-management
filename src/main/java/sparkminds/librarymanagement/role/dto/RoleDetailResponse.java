package sparkminds.librarymanagement.role.dto;

import java.time.LocalDateTime;

public record RoleDetailResponse(
        String code,
        String displayName,
        String description,
        boolean enabled,
        long version,
        boolean systemRole,
        boolean readOnly,
        long accountCount,
        long permissionCount,
        LocalDateTime createdAt
) {
}
