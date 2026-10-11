package sparkminds.librarymanagement.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyEmailRequest(
        @NotBlank(message = "Token xác thực không được để trống")
        @Size(max = 128, message = "Token xác thực không hợp lệ")
        String token
) {
}
