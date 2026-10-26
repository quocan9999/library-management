package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.dto.BookCatalogResponse;
import sparkminds.librarymanagement.common.api.PagedResponse;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BookCatalogService {

    private final BookQueryService bookQueryService;
    private final BookService bookService;

    /** Giữ nguyên search/sort whitelist của Book; DTO riêng không đưa metadata quản trị ra catalog. */
    public PagedResponse<BookCatalogResponse> search(String q, String availability, String page, String size, String sort) {
        var books = bookQueryService.search(q, null, null, null, availability, page, size, sort);
        var content = books.content().stream().map(BookCatalogResponse::from).toList();
        return PagedResponse.of(content, books.page(), books.size(), books.totalElements());
    }

    public BookCatalogResponse get(Integer bookId) {
        var book = bookService.get(bookId);
        return BookCatalogResponse.from(book);
    }
}
