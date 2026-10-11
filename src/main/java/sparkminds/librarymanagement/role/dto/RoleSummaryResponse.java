package sparkminds.librarymanagement.role.dto;

public record RoleSummaryResponse(
        String code,
        String description,
        long version,
        boolean canEdit
) {
}
