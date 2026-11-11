package sparkminds.librarymanagement.category.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * DTO chi tiết danh mục dành cho trang quản trị, kèm số sách đang tham chiếu.
 * Bao gồm version để Admin gửi lại khi cập nhật (khóa lạc quan).
 */
@Schema(example = "{\"id\":1,\"name\":\"Tiểu thuyết\",\"description\":\"Sách văn học kể chuyện hư cấu\",\"bookCount\":12,\"createdAt\":\"2026-11-11T09:00:00\",\"updatedAt\":\"2026-11-11T10:00:00\",\"version\":0}")
public record CategoryResponse(
        Integer id,
        String name,
        String description,
        long bookCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long version
) {
}
