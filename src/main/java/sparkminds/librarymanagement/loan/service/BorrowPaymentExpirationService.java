package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;
import sparkminds.librarymanagement.loan.repository.LoanRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class BorrowPaymentExpirationService {
    private final LoanRepository loanRepository;
    private final BorrowRetryExecutor retryExecutor;
    private final BorrowSystemLoanLockService systemLocks;
    private final BorrowInventoryService inventoryService;
    private final LoanAggregateService aggregateService;
    private final BorrowAuditService auditService;
    private final Clock clock;

    public int expirePendingPayments() {
        LocalDateTime now = now();
        var ids = loanRepository.findExpiredPaymentIds(LoanPaymentStatus.PENDING, now, PageRequest.of(0, 100));
        int expired = 0;
        for (Integer id : ids) if (retryExecutor.execute(() -> expireOne(id))) expired++;
        return expired;
    }

    private boolean expireOne(Integer loanId) {
        var context = systemLocks.lock(loanId);
        if (context == null || context.loan().getPaymentStatus() != LoanPaymentStatus.PENDING
                || context.loan().getPaymentExpiresAt() == null || now().isBefore(context.loan().getPaymentExpiresAt())) {
            return false;
        }
        var affected = new TreeSet<Integer>();
        affected.add(loanId);
        for (var item : context.items()) {
            LoanItemStatus previous = item.getStatus();
            if (!previous.isPending()) continue;
            item.setStatus(LoanItemStatus.EXPIRED);
            if (previous != LoanItemStatus.WAITLISTED) {
                var book = item.getBook();
                book.setAvailableQuantity(book.getAvailableQuantity() + 1);
                inventoryService.allocateWaiting(book, affected);
            }
            auditService.append(item, previous, LoanItemEventReason.PAYMENT_EXPIRED, null, null, null);
        }
        context.loan().setPaymentStatus(LoanPaymentStatus.EXPIRED);
        aggregateService.refresh(affected);
        return true;
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
