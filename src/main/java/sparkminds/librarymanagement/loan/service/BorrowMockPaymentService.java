package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.BorrowRequestResponse;
import sparkminds.librarymanagement.loan.dto.ConfirmMockPaymentRequest;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanOrigin;
import sparkminds.librarymanagement.loan.entity.LoanPaymentMethod;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.EnumSet;

@Service
@RequiredArgsConstructor
public class BorrowMockPaymentService {
    private static final EnumSet<LoanItemStatus> UNPAID_ACTIVE_STATUSES = EnumSet.of(
            LoanItemStatus.WAITLISTED, LoanItemStatus.RESERVED, LoanItemStatus.PREPARING,
            LoanItemStatus.READY_FOR_PICKUP);

    private final BorrowRetryExecutor retryExecutor;
    private final BorrowMemberLockService memberLockService;
    private final LoanRepository loanRepository;
    private final LoanItemRepository itemRepository;
    private final BorrowAuditService auditService;
    private final BorrowQueryService queryService;
    private final EntityManager entityManager;
    private final Clock clock;

    public BorrowRequestResponse confirm(Integer accountId, String loanCode, ConfirmMockPaymentRequest request) {
        return retryExecutor.execute(() -> confirmAttempt(accountId, loanCode, request));
    }

    /** Khoản mock chỉ được ghi nhận một lần sau khi khóa Member→sách→Loan và so khớp số tiền snapshot. */
    private BorrowRequestResponse confirmAttempt(Integer accountId, String loanCode,
                                                 ConfirmMockPaymentRequest request) {
        var member = memberLockService.lock(accountId, true);
        var loan = loanRepository.findOwnedByCode(accountId, loanCode).orElseThrow(BorrowQueryService::notFound);
        var items = itemRepository.findWithBookByLoanId(loan.getId());
        var books = items.stream().map(item -> item.getBook().getId()).distinct().sorted()
                .map(id -> entityManager.find(sparkminds.librarymanagement.book.entity.Book.class, id)).toList();
        books.forEach(book -> entityManager.refresh(book, LockModeType.PESSIMISTIC_WRITE));
        entityManager.refresh(loan, LockModeType.PESSIMISTIC_WRITE);
        items.forEach(entityManager::refresh);

        if (loan.getOrigin() != LoanOrigin.ONLINE) {
            throw conflict("BORROW_PAYMENT_NOT_REQUIRED", "Yêu cầu tạo tại quầy không thanh toán trực tuyến");
        }
        if (loan.getPaymentStatus() == LoanPaymentStatus.PAID) {
            if (loan.getPaymentAmount().compareTo(request.confirmedAmount()) != 0) {
                throw invalidAmount();
            }
            return queryService.getMine(accountId, loanCode);
        }
        if (loan.getPaymentStatus() != LoanPaymentStatus.PENDING) {
            throw conflict("BORROW_PAYMENT_NOT_PENDING", "Yêu cầu không còn chờ thanh toán");
        }
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (loan.getPaymentExpiresAt() == null || !now.isBefore(loan.getPaymentExpiresAt())) {
            throw conflict("BORROW_PAYMENT_EXPIRED", "Thời gian giữ yêu cầu thanh toán đã hết");
        }
        if (loan.getVersion() != request.expectedLoanVersion()) {
            throw conflict("BORROW_VERSION_CONFLICT", "Yêu cầu đã thay đổi, hãy tải lại trước khi xác nhận thanh toán");
        }

        var unpaid = items.stream().filter(item -> UNPAID_ACTIVE_STATUSES.contains(item.getStatus())
                && item.getPaidBorrowFee() == null).toList();
        BigDecimal amount = unpaid.stream().map(item -> item.getBorrowFee()).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (amount.compareTo(loan.getPaymentAmount()) != 0 || amount.compareTo(request.confirmedAmount()) != 0) {
            throw invalidAmount();
        }

        loan.setPaymentStatus(LoanPaymentStatus.PAID);
        loan.setPaymentMethod(LoanPaymentMethod.MOCK_VIETQR);
        loan.setPaidAt(now);
        loan.setPaymentExpiresAt(null);
        unpaid.forEach(item -> {
            item.setPaidBorrowFee(item.getBorrowFee());
            item.setBorrowFeePaidAt(now);
            item.setBorrowFeeConfirmedByAccount(member.getAccount());
            auditService.append(item, item.getStatus(), LoanItemEventReason.MOCK_PAYMENT_CONFIRMED,
                    member.getAccount(), null, null);
        });
        return queryService.getMine(accountId, loanCode);
    }

    private BusinessException invalidAmount() {
        return new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "BORROW_PAYMENT_AMOUNT_MISMATCH",
                "Số tiền xác nhận không khớp khoản phí còn phải thanh toán");
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
