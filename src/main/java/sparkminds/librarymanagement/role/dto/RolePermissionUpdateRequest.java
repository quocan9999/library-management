package sparkminds.librarymanagement.role.dto;

import java.util.List;
import tools.jackson.databind.JsonNode;

public record RolePermissionUpdateRequest(
        JsonNode expectedVersion,
        List<String> addPermissions,
        List<String> removePermissions
) {
}
