package sparkminds.librarymanagement.book.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

/**
 * Yêu cầu tạo mới đầu sách trong hệ thống.
 * Trường price là giá gốc sách, bắt buộc nhập và tối thiểu từ 0đ trở lên.
 * categoryIds là danh mục phân loại tùy chọn; mọi ID phải tồn tại trong hệ thống.
 */
@Schema(example = """
        {"title":"Clean Code","author":"Robert C. Martin","isbn":"9780132350884","publisher":"Prentice Hall","publishedDate":"2008-08-01","totalQuantity":5,"borrowFee":10000.00,"price":150000.00,"lateFeePerDay":2000.00,"categoryIds":[1,3],"confirmSimilar":false}
        """)
public record CreateBookRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 150) String author,
        @Size(max = 20) String isbn,
        @Size(max = 150) String publisher,
        LocalDate publishedDate,
        @NotNull @PositiveOrZero Integer totalQuantity,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal borrowFee,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal price,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal lateFeePerDay,
        Set<Integer> categoryIds,
        Boolean confirmSimilar
) {
    public CreateBookRequest {
        confirmSimilar = confirmSimilar == null ? false : confirmSimilar;
        // Không gửi categoryIds coi như sách chưa phân loại.
        categoryIds = categoryIds == null ? Set.of() : categoryIds;
    }

    public CreateBookRequest(
            String title, String author, String isbn, String publisher,
            LocalDate publishedDate, Integer totalQuantity, BigDecimal borrowFee,
            BigDecimal lateFeePerDay, Boolean confirmSimilar
    ) {
        this(title, author, isbn, publisher, publishedDate, totalQuantity, borrowFee, BigDecimal.valueOf(150000), lateFeePerDay, null, confirmSimilar);
    }
}
