package sparkminds.librarymanagement.adminaccount.dto;

import java.time.LocalDateTime;

public record AdminAccountResponse(
        Integer id,
        String username,
        String email,
        String roleCode,
        String roleDisplayName,
        boolean emailVerified,
        boolean enabled,
        boolean systemAccount,
        long sessionVersion,
        LocalDateTime createdAt,
        StaffProfileResponse staff
) {
    public AdminAccountResponse(
            Integer id,
            String username,
            String email,
            String roleCode,
            String roleDisplayName,
            boolean emailVerified,
            boolean enabled,
            boolean systemAccount,
            long sessionVersion,
            LocalDateTime createdAt
    ) {
        this(id, username, email, roleCode, roleDisplayName, emailVerified, enabled, systemAccount, sessionVersion, createdAt, null);
    }
}
