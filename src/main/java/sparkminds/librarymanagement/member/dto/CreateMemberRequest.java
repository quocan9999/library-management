package sparkminds.librarymanagement.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.Locale;

public record CreateMemberRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank
        @Pattern(regexp = "(?U)^(?=.{8,20}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\p{P}\\p{S}])\\S+$")
        String password,
        @Size(max = 150) String fullName,
        LocalDate dateOfBirth,
        @Size(max = 20) String phone,
        @Size(max = 255) String address
) {
    public CreateMemberRequest {
        // Chuẩn hóa email trước Bean Validation để admin nhập hoa/khoảng trắng vẫn theo đúng Register contract.
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }
}
