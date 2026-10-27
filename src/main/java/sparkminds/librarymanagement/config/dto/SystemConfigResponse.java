package sparkminds.librarymanagement.config.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * DTO phản hồi thông tin cấu hình hệ thống hiện tại.
 */
public record SystemConfigResponse(
        Byte id,
        boolean maintenanceMode,
        String bannerMessage,
        String contactEmail,
        LocalDateTime expectedEndTime,
        LocalDateTime updatedAt,
        Set<String> bypassRoles,
        List<SystemConfigHistoryResponse> recentHistories
) {
}
