package sparkminds.librarymanagement.role.service;

import java.time.Instant;
import java.util.List;

public record RolePermissionAuditEvent(
        Integer actorId,
        String roleCode,
        List<String> addedPermissions,
        List<String> removedPermissions,
        Instant occurredAt
) {
}
