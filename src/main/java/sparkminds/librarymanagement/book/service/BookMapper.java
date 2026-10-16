package sparkminds.librarymanagement.book.service;

import sparkminds.librarymanagement.book.dto.BookDetailResponse;
import sparkminds.librarymanagement.book.dto.BookListItemResponse;
import sparkminds.librarymanagement.book.entity.Book;

/** Chuyển dữ liệu Book thành DTO công khai để API không phụ thuộc hoặc trả trực tiếp JPA Entity. */
final class BookMapper {

    private BookMapper() {
    }

    static BookDetailResponse toDetail(Book book) {
        return new BookDetailResponse(
                book.getId(),
                book.getBookCode(),
                book.getIsbn(),
                book.getTitle(),
                book.getAuthor(),
                book.getPublisher(),
                book.getPublishedDate(),
                book.getTotalQuantity(),
                book.getAvailableQuantity(),
                book.getBorrowFee(),
                book.getLateFeePerDay(),
                book.getCreatedAt(),
                book.getUpdatedAt(),
                book.getVersion()
        );
    }

    static BookListItemResponse toListItem(Book book) {
        return new BookListItemResponse(
                book.getId(),
                book.getBookCode(),
                book.getIsbn(),
                book.getTitle(),
                book.getAuthor(),
                book.getPublisher(),
                book.getPublishedDate(),
                book.getTotalQuantity(),
                book.getAvailableQuantity(),
                book.getBorrowFee(),
                book.getLateFeePerDay(),
                book.getCreatedAt(),
                book.getUpdatedAt()
        );
    }
}
