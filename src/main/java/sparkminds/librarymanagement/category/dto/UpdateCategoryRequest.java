package sparkminds.librarymanagement.category.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Yêu cầu cập nhật danh mục sách. Gửi kèm version đã đọc để phát hiện cập nhật đồng thời.
 */
@Schema(example = "{\"name\":\"Tiểu thuyết hiện đại\",\"description\":\"Văn học hiện đại Việt Nam và thế giới\",\"version\":0}")
public record UpdateCategoryRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 500) String description,
        @NotNull @PositiveOrZero Long version
) {
}
