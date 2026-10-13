package sparkminds.librarymanagement.auth.dto;

import java.util.Locale;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import sparkminds.librarymanagement.auth.validation.PasswordPolicy;

public record RegisterRequest(
        @NotBlank
        @Email
        @Size(max = 255)
        String email,
        @NotBlank
        @Pattern(regexp = PasswordPolicy.REGEX)
        String password) {

    public RegisterRequest {
        // Chuẩn hóa trước Bean Validation và tra cứu để email khác chữ hoa không thành tài khoản riêng.
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }
}
