package sparkminds.librarymanagement.member.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record MemberListItemResponse(
        Integer id,
        String memberCode,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        LocalDateTime createdAt,
        boolean emailVerified,
        boolean enabled
) {
}
