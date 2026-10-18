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

@Schema(example = """
        {"title":"Clean Code, 2nd printing","author":"Robert C. Martin","isbn":"9780132350884","publisher":"Prentice Hall","publishedDate":"2008-08-01","totalQuantity":7,"borrowFee":10000.00,"lateFeePerDay":2000.00,"version":0}
        """)
public record UpdateBookRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 150) String author,
        @Size(max = 20) String isbn,
        @Size(max = 150) String publisher,
        LocalDate publishedDate,
        @NotNull @PositiveOrZero Integer totalQuantity,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal borrowFee,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal lateFeePerDay,
        @NotNull @PositiveOrZero Long version
) {
}
