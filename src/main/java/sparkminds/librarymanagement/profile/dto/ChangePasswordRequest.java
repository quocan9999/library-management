package sparkminds.librarymanagement.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import sparkminds.librarymanagement.auth.validation.PasswordPolicy;

public record ChangePasswordRequest(
        @NotBlank
        String currentPassword,
        @NotBlank
        @Pattern(regexp = PasswordPolicy.REGEX)
        String newPassword,
        @NotBlank
        String confirmNewPassword
) {
}
