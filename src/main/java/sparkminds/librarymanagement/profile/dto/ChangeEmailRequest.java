package sparkminds.librarymanagement.profile.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

public record ChangeEmailRequest(
        @NotBlank(message = "Email mới là bắt buộc")
        @Email(message = "Email mới không hợp lệ")
        @Size(max = 255, message = "Email mới không được vượt quá 255 ký tự")
        String newEmail,
        @NotBlank(message = "Mật khẩu hiện tại là bắt buộc")
        String currentPassword
) {
    public ChangeEmailRequest {
        if (newEmail != null) {
            newEmail = newEmail.trim().toLowerCase(Locale.ROOT);
        }
    }
}
