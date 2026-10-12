package sparkminds.librarymanagement.role.dto;

import java.util.List;

public record PermissionCatalogResponse(
        String code,
        String description,
        boolean manageableByActor,
        List<String> dependencies
) {
}
