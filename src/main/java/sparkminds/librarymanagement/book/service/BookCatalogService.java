package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.dto.BookCatalogResponse;
import sparkminds.librarymanagement.common.api.PagedResponse;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BookCatalogService {

    private final BookQueryService bookQueryService;
    private final BookService bookService;
    private final LoanItemRepository loanItemRepository;

    /** Giữ nguyên search/sort whitelist của Book; DTO riêng không đưa metadata quản trị ra catalog. */
    public PagedResponse<BookCatalogResponse> search(String q, String availability, String page, String size, String sort) {
        var books = bookQueryService.search(q, null, null, null, availability, page, size, sort);
        var ids = books.content().stream().map(book -> book.id()).toList();
        Map<Integer, Long> counts = ids.isEmpty() ? Map.of() : loanItemRepository
                .countByBooksAndStatus(ids, LoanItemStatus.WAITLISTED).stream()
                .collect(Collectors.toMap(LoanItemRepository.BookStatusCount::getBookId,
                        LoanItemRepository.BookStatusCount::getWaitingCount));
        var content = books.content().stream()
                .map(book -> BookCatalogResponse.from(book, counts.getOrDefault(book.id(), 0L))).toList();
        return PagedResponse.of(content, books.page(), books.size(), books.totalElements());
    }

    public BookCatalogResponse get(Integer bookId) {
        var book = bookService.get(bookId);
        return BookCatalogResponse.from(book,
                loanItemRepository.countByBookIdAndStatus(bookId, LoanItemStatus.WAITLISTED));
    }
}
