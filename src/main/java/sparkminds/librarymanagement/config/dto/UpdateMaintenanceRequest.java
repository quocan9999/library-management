package sparkminds.librarymanagement.config.dto;

import jakarta.validation.constraints.Future;
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

        @Future(message = "Thời gian dự kiến hoàn thành phải ở tương lai")
        LocalDateTime expectedEndTime
) {
}
