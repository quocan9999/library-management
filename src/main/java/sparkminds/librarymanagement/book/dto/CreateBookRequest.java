package sparkminds.librarymanagement.book.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateBookRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 150) String author,
        @Size(max = 20) String isbn,
        @Size(max = 150) String publisher,
        LocalDate publishedDate,
        @NotNull @PositiveOrZero Integer totalQuantity,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal borrowFee,
        @NotNull @DecimalMin("0.0") @Digits(integer = 10, fraction = 2) BigDecimal lateFeePerDay,
        Boolean confirmSimilar
) {
    public CreateBookRequest {
        confirmSimilar = confirmSimilar == null ? false : confirmSimilar;
    }
}
