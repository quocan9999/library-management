package sparkminds.librarymanagement.role.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record RoleStatusUpdateRequest(
        @NotNull
        @PositiveOrZero
        Long expectedVersion,
        @NotNull
        Boolean enabled
) {
}
