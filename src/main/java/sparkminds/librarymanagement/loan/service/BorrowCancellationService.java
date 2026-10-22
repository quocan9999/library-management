package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.BorrowRequestResponse;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanPaymentMethod;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;

import java.time.Clock;
import java.time.ZoneOffset;
import java.math.BigDecimal;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class BorrowCancellationService {

    private final BorrowRetryExecutor retryExecutor;
    private final BorrowMemberLockService memberLockService;
    private final LoanRepository loanRepository;
    private final LoanItemRepository loanItemRepository;
    private final BookRepository bookRepository;
    private final BorrowInventoryService inventoryService;
    private final LoanAggregateService aggregateService;
    private final BorrowAuditService auditService;
    private final BorrowQueryService queryService;
    private final EntityManager entityManager;
    private final Clock clock;

    public BorrowRequestResponse cancelOwn(Integer accountId, String loanCode, Integer itemId) {
        return retryExecutor.execute(() -> cancelAttempt(accountId, loanCode, itemId));
    }

    /** Hủy không kiểm tra overdue để Member vẫn giải phóng yêu cầu; chỉ item chưa bàn giao và chưa thu phí được hủy. */
    private BorrowRequestResponse cancelAttempt(Integer accountId, String loanCode, Integer itemId) {
        var member = memberLockService.lock(accountId, false);
        var loan = loanRepository.findOwnedByCode(accountId, loanCode).orElseThrow(BorrowQueryService::notFound);
        var item = loanItemRepository.findById(itemId).filter(value -> value.getLoan().getId().equals(loan.getId()))
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "BORROW_ITEM_NOT_FOUND", "Không tìm thấy sách trong yêu cầu"));
        var book = bookRepository.findByIdForUpdate(item.getBook().getId()).orElseThrow(BorrowQueryService::notFound);
        entityManager.refresh(book, LockModeType.PESSIMISTIC_WRITE);
        // Promotion không khóa Member; sau khi chờ Book phải đọc lại status để không hủy theo snapshot WAITLISTED cũ.
        entityManager.refresh(item);
        LoanItemStatus previous = item.getStatus();
        boolean feeWasCollected = item.getPaidBorrowFee() != null && item.getPaidBorrowFee().signum() > 0;
        if (!previous.isPending() || feeWasCollected || item.getBorrowedAt() != null) {
            throw new BusinessException(HttpStatus.CONFLICT, "BORROW_ITEM_NOT_CANCELLABLE", "Sách không còn ở trạng thái được hủy");
        }
        if (previous == LoanItemStatus.READY_FOR_PICKUP
                && !clock.instant().isBefore(item.getPickupExpiresAt().toInstant(ZoneOffset.UTC))) {
            throw new BusinessException(HttpStatus.CONFLICT, "BORROW_PICKUP_EXPIRED", "Sách đã hết hạn nhận tại quầy");
        }
        item.setStatus(LoanItemStatus.CANCELLED);
        if (previous != LoanItemStatus.WAITLISTED) book.setAvailableQuantity(book.getAvailableQuantity() + 1);
        refreshUnpaidPaymentAmount(loan, now());
        auditService.append(item, previous, LoanItemEventReason.USER_CANCELLED, member.getAccount(),
                NotificationKind.CANCELLED, "item:" + item.getId() + ":cancelled");
        var affected = new TreeSet<Integer>();
        affected.add(loan.getId());
        inventoryService.allocateWaiting(book, affected);
        aggregateService.refresh(affected);
        return queryService.getMine(accountId, loanCode);
    }

    private void refreshUnpaidPaymentAmount(sparkminds.librarymanagement.loan.entity.Loan loan,
                                            java.time.LocalDateTime now) {
        if (loan.getPaymentStatus() != LoanPaymentStatus.PENDING) return;
        BigDecimal amount = loanItemRepository.findByLoanId(loan.getId()).stream()
                .filter(candidate -> candidate.getStatus().isPending() && candidate.getPaidBorrowFee() == null)
                .map(candidate -> candidate.getBorrowFee())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        loan.setPaymentAmount(amount);
        if (amount.signum() == 0) {
            loan.setPaymentStatus(LoanPaymentStatus.PAID);
            loan.setPaymentMethod(LoanPaymentMethod.NO_CHARGE);
            loan.setPaymentExpiresAt(null);
            loan.setPaidAt(now);
        }
    }

    private java.time.LocalDateTime now() {
        return java.time.LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
