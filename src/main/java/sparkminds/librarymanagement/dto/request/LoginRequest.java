package sparkminds.librarymanagement.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "Không được để trống") String identifier,
        @NotBlank(message = "Không được để trống") String password) {
}
