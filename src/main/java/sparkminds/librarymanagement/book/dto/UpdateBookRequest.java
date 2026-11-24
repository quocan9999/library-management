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
 * Yêu cầu cập nhật thông tin đầu sách.
 * Bổ sung trường price để cập nhật giá gốc của sách.
 * categoryIds là danh sách danh mục mới (thay thế toàn bộ); mọi ID phải tồn tại.
 */
@Schema(example = """
        {"title":"Clean Code, 2nd printing","author":"Robert C. Martin","isbn":"9780132350884","publisher":"Prentice Hall","publishedDate":"2008-08-01","totalQuantity":7,"borrowFee":10000.00,"price":150000.00,"lateFeePerDay":2000.00,"categoryIds":[1,3],"version":0}
        """)
public record UpdateBookRequest(
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
        @NotNull @PositiveOrZero Long version
) {
    public UpdateBookRequest {
        // Không gửi categoryIds coi như gỡ toàn bộ danh mục của sách.
        categoryIds = categoryIds == null ? Set.of() : categoryIds;
    }

    public UpdateBookRequest(
            String title, String author, String isbn, String publisher,
            LocalDate publishedDate, Integer totalQuantity, BigDecimal borrowFee,
            BigDecimal lateFeePerDay, Long version
    ) {
        this(title, author, isbn, publisher, publishedDate, totalQuantity, borrowFee, BigDecimal.valueOf(150000), lateFeePerDay, null, version);
    }
}
