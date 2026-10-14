package sparkminds.librarymanagement.role.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record RoleMetadataUpdateRequest(
        @NotNull
        @PositiveOrZero
        Long expectedVersion,
        @NotBlank
        @Size(max = 100)
        String displayName,
        @Size(max = 255)
        String description
) {
}
