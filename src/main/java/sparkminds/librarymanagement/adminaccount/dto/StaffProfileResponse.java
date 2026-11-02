package sparkminds.librarymanagement.adminaccount.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record StaffProfileResponse(
        Integer id,
        String staffCode,
        String fullName,
        LocalDate dateOfBirth,
        String phone,
        String address,
        Long version,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
