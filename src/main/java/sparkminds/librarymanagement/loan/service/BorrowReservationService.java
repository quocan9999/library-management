package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;
import sparkminds.librarymanagement.loan.dto.BorrowRequestResponse;
import sparkminds.librarymanagement.loan.dto.CreateBorrowRequest;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;
import sparkminds.librarymanagement.member.entity.Member;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BorrowReservationService {

    private final BorrowRetryExecutor retryExecutor;
    private final BorrowMemberLockService memberLockService;
    private final BookRepository bookRepository;
    private final LoanRepository loanRepository;
    private final LoanItemRepository loanItemRepository;
    private final BorrowInventoryService inventoryService;
    private final LoanAggregateService aggregateService;
    private final BorrowAuditService auditService;
    private final BorrowQueryService queryService;
    private final EntityManager entityManager;
    private final Clock clock;

    public BorrowRequestResponse create(Integer accountId, CreateBorrowRequest request) {
        List<Integer> bookIds = validateBookIds(request.bookIds());
        return retryExecutor.execute(() -> createAttempt(accountId, bookIds));
    }

    /** Account → Member → Book ID tăng dần; mọi attempt đọc lại điều kiện và snapshot trong transaction mới. */
    private BorrowRequestResponse createAttempt(Integer accountId, List<Integer> bookIds) {
        Member member = memberLockService.lock(accountId, true);
        validateEligibility(member.getId(), bookIds);
        var books = lockBooks(bookIds);
        var affectedLoans = new TreeSet<Integer>();
        var statuses = new ArrayList<LoanItemStatus>();
        for (Book book : books) {
            inventoryService.allocateWaiting(book, affectedLoans);
            statuses.add(allocateNewItem(book));
        }

        Loan loan = new Loan();
        loan.setLoanCode("TMP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        loan.setMember(member);
        loan.setStatus(LoanStatus.OPEN);
        loanRepository.saveAndFlush(loan);
        loan.setLoanCode(String.format(Locale.ROOT, "L%06d", loan.getId()));
        loanRepository.saveAndFlush(loan);
        for (int index = 0; index < books.size(); index++) {
            LoanItem item = createItem(loan, books.get(index), statuses.get(index));
            // Một ý định email cho cả yêu cầu; từng item vẫn có audit REQUEST_CREATED riêng.
            auditService.append(item, null, LoanItemEventReason.REQUEST_CREATED, member.getAccount(),
                    index == 0 ? NotificationKind.REQUEST_CREATED : null,
                    index == 0 ? "loan:" + loan.getId() + ":request-created" : null);
        }
        affectedLoans.add(loan.getId());
        aggregateService.refresh(affectedLoans);
        return queryService.getMine(accountId, loan.getLoanCode());
    }

    private void validateEligibility(Integer memberId, List<Integer> bookIds) {
        if (loanItemRepository.existsByLoanMemberIdAndStatusAndDueDateBefore(
                memberId, LoanItemStatus.BORROWED, LocalDate.now(clock))) {
            throw conflict("BORROW_OUTSTANDING_OBLIGATION", "Bạn đang có sách quá hạn chưa giải quyết");
        }
        long active = loanItemRepository.countByLoanMemberIdAndStatusIn(memberId, BorrowPolicy.ACTIVE_STATUSES);
        if (active + bookIds.size() > BorrowPolicy.MAX_ACTIVE_BOOKS) {
            throw conflict("BORROW_ACTIVE_LIMIT_EXCEEDED", "Mỗi thành viên chỉ được có tối đa 3 đầu sách đang hoạt động");
        }
        if (loanItemRepository.existsByLoanMemberIdAndBookIdInAndStatusIn(memberId, bookIds, BorrowPolicy.ACTIVE_STATUSES)) {
            throw conflict("BORROW_DUPLICATE_ACTIVE_BOOK", "Đầu sách đã có trong yêu cầu mượn đang hoạt động");
        }
    }

    private List<Book> lockBooks(List<Integer> bookIds) {
        List<Book> books = new ArrayList<>();
        for (Integer bookId : bookIds) {
            Book book = bookRepository.findByIdForUpdate(bookId).orElseThrow(() -> new BusinessException(
                    HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", "Không tìm thấy sách"));
            entityManager.refresh(book, LockModeType.PESSIMISTIC_WRITE);
            books.add(book);
        }
        return books;
    }

    private LoanItemStatus allocateNewItem(Book book) {
        if (book.getAvailableQuantity() > 0) {
            book.setAvailableQuantity(book.getAvailableQuantity() - 1);
            return LoanItemStatus.RESERVED;
        }
        if (loanItemRepository.countByBookIdAndStatus(book.getId(), LoanItemStatus.WAITLISTED)
                >= BorrowPolicy.waitlistCap(book.getTotalQuantity())) {
            throw conflict("BORROW_WAITLIST_FULL", "Hàng chờ của đầu sách đã đầy");
        }
        return LoanItemStatus.WAITLISTED;
    }

    private LoanItem createItem(Loan loan, Book book, LoanItemStatus status) {
        LoanItem item = new LoanItem();
        item.setLoan(loan);
        item.setBook(book);
        item.setStatus(status);
        item.setBorrowFee(book.getBorrowFee());
        item.setLateFeePerDay(book.getLateFeePerDay());
        if (status == LoanItemStatus.WAITLISTED) {
            item.setWaitlistedAt(LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
        }
        return loanItemRepository.save(item);
    }

    private List<Integer> validateBookIds(List<Integer> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > BorrowPolicy.MAX_REQUEST_BOOKS
                || ids.stream().anyMatch(id -> id == null || id <= 0) || new HashSet<>(ids).size() != ids.size()) {
            throw new FieldValidationException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Dữ liệu không hợp lệ",
                    Map.of("bookIds", "Chọn từ 1 đến 3 đầu sách khác nhau với ID hợp lệ"));
        }
        return ids.stream().sorted().toList();
    }

    private static BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
