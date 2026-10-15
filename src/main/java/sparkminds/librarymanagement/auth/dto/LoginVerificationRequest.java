package sparkminds.librarymanagement.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record LoginVerificationRequest(
        @NotBlank(message = "Tên đăng nhập hoặc email không được để trống")
        @Size(max = 255, message = "Tên đăng nhập hoặc email tối đa 255 ký tự")
        String identifier
) {
    public LoginVerificationRequest {
        if (identifier != null) {
            identifier = identifier.trim();
            if (identifier.contains("@")) identifier = identifier.toLowerCase(Locale.ROOT);
        }
    }
}
