package sparkminds.librarymanagement.config.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO phản hồi thông tin cấu hình hệ thống.
 */
public record SystemConfigResponse(
        Integer id,
        boolean maintenanceMode,
        LocalDateTime expectedEndTime,
        LocalDateTime updatedAt,
        List<SystemConfigHistoryResponse> recentHistories
) {
}
