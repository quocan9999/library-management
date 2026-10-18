package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.dto.BookDetailResponse;
import sparkminds.librarymanagement.book.dto.CreateBookRequest;
import sparkminds.librarymanagement.book.dto.UpdateBookRequest;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.book.cover.BookCoverObsolete;
import sparkminds.librarymanagement.book.cover.UploadedBookCover;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.book.repository.BookSimilarityRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookTransactionService {

    private final BookRepository bookRepository;
    private final BookSimilarityRepository bookSimilarityRepository;
    private final LoanItemRepository loanItemRepository;
    private final ApplicationEventPublisher events;

    /**
     * Tạo một đầu sách sau khi chuẩn hóa thông tin và kiểm tra ISBN/sách tương tự.
     *
     * <p>Mã tạm duy nhất được ghi cùng bản ghi để lấy ID AUTO_INCREMENT, sau đó đổi thành mã B theo ID
     * trong cùng transaction; vì vậy rollback không để lại mã tạm hoặc Book chưa hoàn chỉnh.
     */
    @Transactional
    public BookDetailResponse create(CreateBookRequest request) {
        return create(request, null);
    }

    /** Lưu metadata ảnh trong cùng transaction tạo sách; upload đã hoàn tất ngoài transaction. */
    @Transactional
    public BookDetailResponse create(CreateBookRequest request, UploadedBookCover cover) {
        String title = BookRules.normalizeRequiredText(request.title());
        String author = BookRules.normalizeRequiredText(request.author());
        String isbn = normalizeIsbn(request.isbn());

        if (isbn != null && bookRepository.existsByIsbn(isbn)) {
            throw isbnConflict();
        }
        if (isbn == null) {
            // Giữ lock đến commit để hai create không ISBN không thể vượt qua cùng một lần kiểm tra.
            bookSimilarityRepository.acquireNoIsbnCreationLock();
            if (!request.confirmSimilar() && bookSimilarityRepository.existsWithoutIsbn(title, author)) {
                throw similarBookConfirmationRequired();
            }
        }

        Book book = new Book();
        book.setBookCode(temporaryBookCode());
        book.setIsbn(isbn);
        book.setTitle(title);
        book.setAuthor(author);
        book.setPublisher(BookRules.normalizeOptionalText(request.publisher()));
        book.setPublishedDate(request.publishedDate());
        book.setTotalQuantity(request.totalQuantity());
        book.setAvailableQuantity(request.totalQuantity());
        book.setBorrowFee(request.borrowFee());
        book.setLateFeePerDay(request.lateFeePerDay());
        if (cover != null) {
            book.setCoverImageUrl(cover.url());
            book.setCoverImagePublicId(cover.publicId());
        }

        bookRepository.saveAndFlush(book);
        book.setBookCode(formatBookCode(book.getId()));
        bookRepository.saveAndFlush(book);

        return BookMapper.toDetail(book);
    }

    /**
     * Thay thế các trường Admin được phép sửa và cập nhật tồn khả dụng theo số sách đang không khả dụng.
     *
     * <p>Kiểm tra version trước khi thay đổi và flush ngay trong transaction để phát hiện cả stale request
     * lẫn cuộc đua xảy ra sau lần đọc; số lượng unavailable được giữ nguyên khi tổng số lượng thay đổi.
     */
    @Transactional
    public BookDetailResponse update(Integer id, UpdateBookRequest request) {
        return update(id, request, null);
    }

    /** Giữ nguyên ảnh khi cover=null; xóa ảnh cũ bằng sự kiện AFTER_COMMIT để rollback không làm mất ảnh. */
    @Transactional
    public BookDetailResponse update(Integer id, UpdateBookRequest request, UploadedBookCover cover) {
        Book book = bookRepository.findById(id)
                .orElseThrow(BookTransactionService::bookNotFound);
        if (!Objects.equals(book.getVersion(), request.version())) {
            throw versionConflict();
        }

        String isbn = normalizeIsbn(request.isbn());
        if (isbn != null && !isbn.equals(book.getIsbn()) && bookRepository.existsByIsbnAndIdNot(isbn, id)) {
            throw isbnConflict();
        }

        int unavailableQuantity = book.getTotalQuantity() - book.getAvailableQuantity();
        if (request.totalQuantity() < unavailableQuantity) {
            throw new FieldValidationException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "BOOK_VALIDATION_ERROR",
                    "Dữ liệu sách không hợp lệ",
                    Map.of("totalQuantity", "Tổng số lượng không được thấp hơn số sách đang không khả dụng")
            );
        }

        book.setTitle(BookRules.normalizeRequiredText(request.title()));
        book.setAuthor(BookRules.normalizeRequiredText(request.author()));
        book.setIsbn(isbn);
        book.setPublisher(BookRules.normalizeOptionalText(request.publisher()));
        book.setPublishedDate(request.publishedDate());
        book.setTotalQuantity(request.totalQuantity());
        book.setAvailableQuantity(request.totalQuantity() - unavailableQuantity);
        book.setBorrowFee(request.borrowFee());
        book.setLateFeePerDay(request.lateFeePerDay());

        if (cover != null) {
            String oldPublicId = book.getCoverImagePublicId();
            book.setCoverImageUrl(cover.url());
            book.setCoverImagePublicId(cover.publicId());
            if (oldPublicId != null) events.publishEvent(new BookCoverObsolete(oldPublicId));
        }

        try {
            bookRepository.saveAndFlush(book);
        } catch (OptimisticLockingFailureException exception) {
            throw versionConflict();
        }
        return BookMapper.toDetail(book);
    }

    /**
     * Xóa sách chưa phát sinh lịch sử mượn.
     *
     * <p>Kiểm tra LoanItem trước, sau đó xóa và flush trong cùng transaction; FK RESTRICT
     * là lớp bảo vệ cuối để rollback việc xóa nếu lịch sử được tạo đồng thời sau bước kiểm tra.
     *
     * @param id ID sách cần xóa
     * @throws BusinessException nếu không tìm thấy sách hoặc sách đã có lịch sử mượn
     */
    @Transactional
    public void delete(Integer id) {
        Book book = bookRepository.findById(id)
                .orElseThrow(BookTransactionService::bookNotFound);
        if (loanItemRepository.existsByBookId(id)) {
            throw historyConflict();
        }
        bookRepository.delete(book);
        // Flush trong transaction để FK RESTRICT chặn lịch sử LoanItem phát sinh sau bước kiểm tra.
        bookRepository.flush();
        if (book.getCoverImagePublicId() != null) {
            events.publishEvent(new BookCoverObsolete(book.getCoverImagePublicId()));
        }
    }

    private String normalizeIsbn(String value) {
        try {
            return BookRules.normalizeIsbn(value);
        } catch (IllegalArgumentException exception) {
            throw new FieldValidationException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "BOOK_VALIDATION_ERROR",
                    "Dữ liệu sách không hợp lệ",
                    Map.of("isbn", exception.getMessage())
            );
        }
    }

    private static String temporaryBookCode() {
        return "TMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }

    private static String formatBookCode(Integer id) {
        return String.format(Locale.ROOT, "B%06d", id);
    }

    private static BusinessException isbnConflict() {
        return new BusinessException(HttpStatus.CONFLICT, "BOOK_ISBN_DUPLICATED", "ISBN đã được sử dụng");
    }

    static BusinessException bookNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", "Không tìm thấy sách");
    }

    static BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "BOOK_VERSION_CONFLICT",
                "Thông tin sách đã được cập nhật bởi Admin khác. Tải lại dữ liệu trước khi thử lại."
        );
    }

    static BusinessException historyConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "BOOK_HAS_LOAN_HISTORY",
                "Không thể xóa sách đã có lịch sử mượn"
        );
    }

    private static BusinessException similarBookConfirmationRequired() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "SIMILAR_BOOK_CONFIRMATION_REQUIRED",
                "Đã có sách không ISBN cùng tên và tác giả. Xác nhận để tiếp tục tạo sách mới."
        );
    }
}
