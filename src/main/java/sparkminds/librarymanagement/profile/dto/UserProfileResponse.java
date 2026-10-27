package sparkminds.librarymanagement.profile.dto;

import java.time.LocalDate;

public record UserProfileResponse(
        Integer accountId,
        String username,
        String email,
        String role,
        Integer memberId,
        String memberCode,
        String fullName,
        LocalDate dateOfBirth,
        String phone,
        String address,
        Long version
) {
}
