package sparkminds.librarymanagement.auth.dto;

import java.util.Locale;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank
        @Email
        @Size(max = 255)
        String email,
        @NotBlank
        @Pattern(regexp = "(?U)^(?=.{8,20}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\p{P}\\p{S}])\\S+$")
        String password) {

    public RegisterRequest {
        // Chuẩn hóa trước Bean Validation và tra cứu để email khác chữ hoa không thành tài khoản riêng.
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }
}
