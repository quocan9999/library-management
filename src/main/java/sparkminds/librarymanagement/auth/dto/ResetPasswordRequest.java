package sparkminds.librarymanagement.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import sparkminds.librarymanagement.auth.validation.PasswordPolicy;

public record ResetPasswordRequest(
        @NotBlank(message = "Token không được để trống")
        String token,
        @NotBlank(message = "Vui lòng nhập mật khẩu mới")
        @Pattern(regexp = PasswordPolicy.REGEX, message = "Mật khẩu chưa đáp ứng yêu cầu")
        String newPassword,
        @NotBlank(message = "Vui lòng xác nhận mật khẩu mới")
        String confirmNewPassword
) {
}
