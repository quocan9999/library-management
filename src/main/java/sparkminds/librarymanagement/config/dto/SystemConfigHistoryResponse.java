package sparkminds.librarymanagement.config.dto;

import java.time.LocalDateTime;

/**
 * DTO phản hồi mục lịch sử thay đổi cấu hình.
 */
public record SystemConfigHistoryResponse(
        Long id,
        String action,
        String actorUsername,
        String reason,
        String detail,
        LocalDateTime createdAt
) {
}
