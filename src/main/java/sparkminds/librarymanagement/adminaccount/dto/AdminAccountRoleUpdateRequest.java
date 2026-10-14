package sparkminds.librarymanagement.adminaccount.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.Locale;

public record AdminAccountRoleUpdateRequest(
        @NotBlank @Size(max = 50) String roleCode,
        @NotNull @PositiveOrZero Long expectedSessionVersion
) {
    public AdminAccountRoleUpdateRequest {
        if (roleCode != null) roleCode = roleCode.trim().toUpperCase(Locale.ROOT);
    }
}
