package sparkminds.librarymanagement.category.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Thông tin rút gọn của danh mục, dùng trong danh sách sách và dropdown chọn danh mục.
 */
@Schema(example = "{\"id\":1,\"name\":\"Tiểu thuyết\"}")
public record CategorySummary(
        Integer id,
        String name
) {
}
