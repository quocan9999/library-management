package sparkminds.librarymanagement.role.dto;

public record PermissionCatalogResponse(
        String code,
        String description,
        boolean manageableByActor
) {
}
