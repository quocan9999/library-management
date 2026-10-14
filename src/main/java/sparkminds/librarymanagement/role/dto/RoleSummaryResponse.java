package sparkminds.librarymanagement.role.dto;

public record RoleSummaryResponse(
        String code,
        String displayName,
        String description,
        boolean enabled,
        long version,
        boolean canEdit
) {
}
