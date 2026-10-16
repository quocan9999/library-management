package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.dto.BookDetailResponse;
import sparkminds.librarymanagement.book.dto.CreateBookRequest;
import sparkminds.librarymanagement.book.dto.UpdateBookRequest;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

@Service
@RequiredArgsConstructor
public class BookService {

    private final BookTransactionService transactionService;
    private final BookRepository bookRepository;
    private final LoanItemRepository loanItemRepository;

    /**
     * Tạo sách và chuyển lỗi UNIQUE ISBN nếu hai request cùng ghi một ISBN.
     *
     * <p>Transaction ghi nằm trong {@link BookTransactionService}; khi flush phát hiện duplicate,
     * transaction đó rollback trước khi facade kiểm tra ISBN đã được request còn lại lưu hay chưa.
     *
     * @param request dữ liệu sách đã qua validation cấu trúc
     * @return thông tin sách vừa tạo
     * @throws BusinessException nếu ISBN đã tồn tại hoặc cần xác nhận sách tương tự
     */
    public BookDetailResponse create(CreateBookRequest request) {
        try {
            return transactionService.create(request);
        } catch (DataIntegrityViolationException exception) {
            String isbn;
            try {
                isbn = BookRules.normalizeIsbn(request.isbn());
            } catch (IllegalArgumentException invalidIsbn) {
                throw exception;
            }
            if (isbn != null && bookRepository.existsByIsbn(isbn)) {
                throw new BusinessException(HttpStatus.CONFLICT, "BOOK_ISBN_DUPLICATED", "ISBN đã được sử dụng");
            }
            throw exception;
        }
    }

    /** Trả DTO chi tiết trong transaction chỉ đọc để Entity không bị lộ qua API. */
    @Transactional(readOnly = true)
    public BookDetailResponse get(Integer id) {
        return bookRepository.findById(id)
                .map(BookMapper::toDetail)
                .orElseThrow(BookTransactionService::bookNotFound);
}
    public BookDetailResponse update(Integer id, UpdateBookRequest request) {
        try {
            return transactionService.update(id, request);
        } catch (DataIntegrityViolationException exception) {
            String isbn;
            try {
                isbn = BookRules.normalizeIsbn(request.isbn());
            } catch (IllegalArgumentException invalidIsbn) {
                throw exception;
            }
            if (isbn != null && bookRepository.existsByIsbnAndIdNot(isbn, id)) {
                throw new BusinessException(HttpStatus.CONFLICT, "BOOK_ISBN_DUPLICATED", "ISBN đã được sử dụng");
            }
            throw exception;
        }
    }

    /**
     * Xóa sách và đổi lỗi FK thành conflict chỉ khi LoanItem vừa được tạo đồng thời.
     *
     * @param id ID sách cần xóa
     * @throws BusinessException nếu không tìm thấy sách hoặc có lịch sử mượn
     */
    public void delete(Integer id) {
        try {
            transactionService.delete(id);
        } catch (DataIntegrityViolationException exception) {
            if (bookRepository.existsById(id) && loanItemRepository.existsByBookId(id)) {
                throw BookTransactionService.historyConflict();
            }
            throw exception;
        }
    }

}
