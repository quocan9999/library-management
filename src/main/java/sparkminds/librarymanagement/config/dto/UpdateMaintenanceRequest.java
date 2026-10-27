package sparkminds.librarymanagement.config.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * DTO yêu cầu cập nhật trạng thái bảo trì hệ thống.
 */
public record UpdateMaintenanceRequest(
        @NotNull(message = "Trạng thái bảo trì không được để trống")
        Boolean maintenanceMode,

        @Size(max = 255, message = "Lý do không được vượt quá 255 ký tự")
        String reason,

        @Size(max = 500, message = "Thông báo bảo trì không được vượt quá 500 ký tự")
        String bannerMessage,

        @Email(message = "Email liên hệ không đúng định dạng")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự")
        String contactEmail,

        LocalDateTime expectedEndTime
) {
}
