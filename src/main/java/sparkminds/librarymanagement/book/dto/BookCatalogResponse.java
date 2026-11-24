package sparkminds.librarymanagement.book.dto;

import sparkminds.librarymanagement.category.dto.CategorySummary;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * DTO trả về thông tin sách trong danh mục tra cứu công khai cho độc giả.
 * Bao gồm phí mượn, giá gốc (tiền cọc) và danh sách danh mục phân loại.
 */
public record BookCatalogResponse(
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
        String coverImageUrl
) {
    public BookCatalogResponse(
            Integer id, String bookCode, String isbn, String title, String author,
            String publisher, LocalDate publishedDate, Integer totalQuantity,
            Integer availableQuantity, BigDecimal borrowFee, BigDecimal price,
            BigDecimal lateFeePerDay, String coverImageUrl
    ) {
        this(id, bookCode, isbn, title, author, publisher, publishedDate, totalQuantity,
                availableQuantity, borrowFee, price, lateFeePerDay, List.of(), coverImageUrl);
    }

    public static BookCatalogResponse from(BookListItemResponse book) {
        return new BookCatalogResponse(book.id(), book.bookCode(), book.isbn(), book.title(), book.author(),
                book.publisher(), book.publishedDate(), book.totalQuantity(), book.availableQuantity(),
                book.borrowFee(), book.price(), book.lateFeePerDay(), book.categories(), book.coverImageUrl());
    }

    public static BookCatalogResponse from(BookDetailResponse book) {
        return new BookCatalogResponse(book.id(), book.bookCode(), book.isbn(), book.title(), book.author(),
                book.publisher(), book.publishedDate(), book.totalQuantity(), book.availableQuantity(),
                book.borrowFee(), book.price(), book.lateFeePerDay(), book.categories(), book.coverImageUrl());
    }
}
