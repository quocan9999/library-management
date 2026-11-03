package sparkminds.librarymanagement.book.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO trả về chi tiết đầy đủ của một đầu sách.
 * Bao gồm trường price đại diện cho giá gốc sách.
 */
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
        BigDecimal price,
        BigDecimal lateFeePerDay,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long version,
        String coverImageUrl
) {
    public BookDetailResponse(
            Integer id, String bookCode, String isbn, String title, String author,
            String publisher, LocalDate publishedDate, Integer totalQuantity,
            Integer availableQuantity, BigDecimal borrowFee, BigDecimal lateFeePerDay,
            LocalDateTime createdAt, LocalDateTime updatedAt, Long version, String coverImageUrl
    ) {
        this(id, bookCode, isbn, title, author, publisher, publishedDate, totalQuantity, availableQuantity, borrowFee, BigDecimal.ZERO, lateFeePerDay, createdAt, updatedAt, version, coverImageUrl);
    }
}
