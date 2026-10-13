package sparkminds.librarymanagement.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyChangeEmailRequest(
        @NotBlank(message = "Mã xác thực là bắt buộc")
        @Pattern(regexp = "\\d{6}", message = "Mã xác thực phải gồm đúng 6 chữ số")
        String code
) {
}
