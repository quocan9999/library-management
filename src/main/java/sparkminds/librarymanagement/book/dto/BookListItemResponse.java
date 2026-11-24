package sparkminds.librarymanagement.book.dto;

import sparkminds.librarymanagement.category.dto.CategorySummary;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO trả về thông tin rút gọn của đầu sách trong danh sách quản trị.
 * Bổ sung giá gốc price và danh sách danh mục phân loại.
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
        List<CategorySummary> categories,
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
        this(id, bookCode, isbn, title, author, publisher, publishedDate, totalQuantity, availableQuantity, borrowFee, BigDecimal.ZERO, lateFeePerDay, List.of(), createdAt, updatedAt, coverImageUrl);
    }
}
