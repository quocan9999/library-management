package sparkminds.librarymanagement.adminaccount.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import sparkminds.librarymanagement.auth.validation.PasswordPolicy;

import java.util.Locale;

public record AdminAccountCreateRequest(
        @NotBlank @Size(max = 20) String username,
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Pattern(regexp = PasswordPolicy.REGEX) String password,
        @NotBlank @Size(max = 50) String roleCode
) {
    public AdminAccountCreateRequest {
        if (username != null) username = username.trim();
        if (email != null) email = email.trim().toLowerCase(Locale.ROOT);
        if (roleCode != null) roleCode = roleCode.trim().toUpperCase(Locale.ROOT);
    }
}
