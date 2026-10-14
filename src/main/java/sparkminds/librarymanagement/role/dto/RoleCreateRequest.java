package sparkminds.librarymanagement.role.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RoleCreateRequest(
        @NotBlank
        @Size(max = 50)
        @Pattern(regexp = "^[A-Z][A-Z0-9_]*$", message = "Mã vai trò phải viết hoa và chỉ chứa chữ cái, số, dấu gạch dưới")
        String code,
        @NotBlank
        @Size(max = 100)
        String displayName,
        @Size(max = 255)
        String description,
        @NotNull
        @NotEmpty
        @Size(max = 100)
        List<@NotBlank String> permissions
) {
}
