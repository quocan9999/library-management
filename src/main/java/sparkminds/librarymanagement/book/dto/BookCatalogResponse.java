package sparkminds.librarymanagement.book.dto;

import sparkminds.librarymanagement.loan.service.BorrowPolicy;

import java.math.BigDecimal;
import java.time.LocalDate;

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
        BigDecimal lateFeePerDay,
        String coverImageUrl,
        long waitlistCount,
        long waitlistCap
) {
    public static BookCatalogResponse from(BookListItemResponse book, long waitingCount) {
        return new BookCatalogResponse(book.id(), book.bookCode(), book.isbn(), book.title(), book.author(),
                book.publisher(), book.publishedDate(), book.totalQuantity(), book.availableQuantity(),
                book.borrowFee(), book.lateFeePerDay(), book.coverImageUrl(), waitingCount, BorrowPolicy.waitlistCap(book.totalQuantity()));
    }

    public static BookCatalogResponse from(BookDetailResponse book, long waitingCount) {
        return new BookCatalogResponse(book.id(), book.bookCode(), book.isbn(), book.title(), book.author(),
                book.publisher(), book.publishedDate(), book.totalQuantity(), book.availableQuantity(),
                book.borrowFee(), book.lateFeePerDay(), book.coverImageUrl(), waitingCount, BorrowPolicy.waitlistCap(book.totalQuantity()));
    }
}
