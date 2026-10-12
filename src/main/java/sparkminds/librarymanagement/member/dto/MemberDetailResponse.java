package sparkminds.librarymanagement.member.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record MemberDetailResponse(
        Integer id,
        String memberCode,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String address,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean emailVerified,
        boolean enabled,
        Long version,
        long borrowedItemCount
) {
}
