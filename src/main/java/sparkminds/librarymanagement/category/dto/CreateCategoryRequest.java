package sparkminds.librarymanagement.category.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Yêu cầu tạo danh mục sách mới. Tên là bắt buộc và duy nhất không phân biệt hoa thường.
 */
@Schema(example = "{\"name\":\"Tiểu thuyết\",\"description\":\"Sách văn học kể chuyện hư cấu\"}")
public record CreateCategoryRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 500) String description
) {
}
