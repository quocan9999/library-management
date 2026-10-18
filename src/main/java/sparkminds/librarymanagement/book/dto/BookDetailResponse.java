package sparkminds.librarymanagement.book.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record BookDetailResponse(
        Integer id,
        String bookCode,
        String isbn,
        String title,
        String author,
        String publisher,
        LocalDate publishedDate,
        Integer totalQuantity,
        Integer availableQuantity,
        BigDecimal borrowFee,
        BigDecimal lateFeePerDay,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long version,
        String coverImageUrl
) {
}
