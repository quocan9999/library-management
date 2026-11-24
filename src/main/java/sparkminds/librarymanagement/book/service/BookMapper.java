package sparkminds.librarymanagement.book.service;

import sparkminds.librarymanagement.book.dto.BookDetailResponse;
import sparkminds.librarymanagement.book.dto.BookListItemResponse;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.category.dto.CategorySummary;
import sparkminds.librarymanagement.category.service.CategoryMapper;

import java.util.List;

/**
 * Chuyển dữ liệu Book thành DTO công khai để API không phụ thuộc hoặc trả trực tiếp JPA Entity.
 * Đảm bảo map đầy đủ trường price (giá gốc/tiền cọc) và danh mục phân loại.
 */
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
                book.getPrice(),
                book.getLateFeePerDay(),
                toCategories(book),
                book.getCreatedAt(),
                book.getUpdatedAt(),
                book.getVersion(),
                book.getCoverImageUrl()
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
                book.getPrice(),
                book.getLateFeePerDay(),
                toCategories(book),
                book.getCreatedAt(),
                book.getUpdatedAt(),
                book.getCoverImageUrl()
        );
    }

    /** Danh mục của sách sắp theo tên; gọi nơi categories đã được nạp (EntityGraph) để tránh N+1. */
    private static List<CategorySummary> toCategories(Book book) {
        return book.getCategories().stream()
                .map(CategoryMapper::toSummary)
                .sorted(CategoryMapper.byName())
                .toList();
    }
}
