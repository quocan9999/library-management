package sparkminds.librarymanagement.book.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO trả về thông tin rút gọn của đầu sách trong danh sách quản trị.
 * Bổ sung giá gốc price.
 */
public record BookListItemResponse(
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
        String coverImageUrl
) {
    public BookListItemResponse(
            Integer id, String bookCode, String isbn, String title, String author,
            String publisher, LocalDate publishedDate, Integer totalQuantity,
            Integer availableQuantity, BigDecimal borrowFee, BigDecimal lateFeePerDay,
            LocalDateTime createdAt, LocalDateTime updatedAt, String coverImageUrl
    ) {
        this(id, bookCode, isbn, title, author, publisher, publishedDate, totalQuantity, availableQuantity, borrowFee, BigDecimal.ZERO, lateFeePerDay, createdAt, updatedAt, coverImageUrl);
    }
}
