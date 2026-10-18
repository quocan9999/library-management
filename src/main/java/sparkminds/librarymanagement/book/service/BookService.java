package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import sparkminds.librarymanagement.book.cover.BookCoverService;
import sparkminds.librarymanagement.book.cover.UploadedBookCover;
import sparkminds.librarymanagement.book.dto.BookDetailResponse;
import sparkminds.librarymanagement.book.dto.CreateBookRequest;
import sparkminds.librarymanagement.book.dto.UpdateBookRequest;
import sparkminds.librarymanagement.book.logging.BookOperationLog;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

@Service
@RequiredArgsConstructor
public class BookService {

    private final BookTransactionService transactionService;
    private final BookRepository bookRepository;
    private final LoanItemRepository loanItemRepository;
    private final BookCoverService coverService;

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
    @BookOperationLog("book.create")
    public BookDetailResponse create(CreateBookRequest request) {
        return create(request, null);
    }

    /** Upload trước transaction DB; dọn ảnh mới nếu validation nghiệp vụ hoặc commit thất bại. */
    @BookOperationLog("book.create")
    public BookDetailResponse create(CreateBookRequest request, MultipartFile file) {
        UploadedBookCover cover = coverService.uploadOptional(file);
        try {
            return transactionService.create(request, cover);
        } catch (RuntimeException exception) {
            if (cover != null) coverService.discard(cover.publicId());
            if (!(exception instanceof DataIntegrityViolationException)) throw exception;
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
    @BookOperationLog("book.detail")
    public BookDetailResponse get(Integer id) {
        return bookRepository.findById(id)
                .map(BookMapper::toDetail)
                .orElseThrow(BookTransactionService::bookNotFound);
    }

    @BookOperationLog("book.update")
    public BookDetailResponse update(Integer id, UpdateBookRequest request) {
        return update(id, request, null);
    }

    /** Upload không giữ transaction DB; kiểm tra version trong transaction trước khi thay metadata ảnh. */
    @BookOperationLog("book.update")
    public BookDetailResponse update(Integer id, UpdateBookRequest request, MultipartFile file) {
        UploadedBookCover cover = coverService.uploadOptional(file);
        try {
            return transactionService.update(id, request, cover);
        } catch (RuntimeException exception) {
            if (cover != null) coverService.discard(cover.publicId());
            if (!(exception instanceof DataIntegrityViolationException)) throw exception;
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
    @BookOperationLog("book.delete")
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
