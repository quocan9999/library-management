package sparkminds.librarymanagement.adminaccount.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import sparkminds.librarymanagement.auth.validation.PasswordPolicy;

import java.time.LocalDate;
import java.util.Locale;

public record AdminAccountCreateRequest(
        @NotBlank(message = "Tên đăng nhập là bắt buộc")
        @Size(max = 20, message = "Tên đăng nhập không được vượt quá 20 ký tự")
        String username,

        @NotBlank(message = "Email là bắt buộc")
        @Email(message = "Email không hợp lệ")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự")
        String email,

        @NotBlank(message = "Mật khẩu là bắt buộc")
        @Pattern(regexp = PasswordPolicy.REGEX, message = "Mật khẩu không đáp ứng chính sách bảo mật")
        String password,

        @NotBlank(message = "Nhóm quyền là bắt buộc")
        @Size(max = 50, message = "Nhóm quyền không được vượt quá 50 ký tự")
        String roleCode,

        @NotBlank(message = "Họ và tên là bắt buộc")
        @Size(max = 150, message = "Họ và tên không được vượt quá 150 ký tự")
        String fullName,

        @NotNull(message = "Ngày sinh là bắt buộc")
        LocalDate dateOfBirth,

        @NotBlank(message = "Số điện thoại là bắt buộc")
        String phone,

        @Size(max = 255, message = "Địa chỉ không được vượt quá 255 ký tự")
        String address
) {
    public AdminAccountCreateRequest {
        if (username != null) username = username.trim();
        if (email != null) email = email.trim().toLowerCase(Locale.ROOT);
        if (roleCode != null) roleCode = roleCode.trim().toUpperCase(Locale.ROOT);
        if (fullName != null) fullName = fullName.trim();
        if (address != null) address = address.trim();
    }
}
