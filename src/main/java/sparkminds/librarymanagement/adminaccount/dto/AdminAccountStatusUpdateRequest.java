package sparkminds.librarymanagement.adminaccount.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record AdminAccountStatusUpdateRequest(
        @NotNull Boolean enabled,
        @NotNull @PositiveOrZero Long expectedSessionVersion
) {
}
