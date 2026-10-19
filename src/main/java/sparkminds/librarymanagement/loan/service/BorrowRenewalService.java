package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.BorrowRenewalResponse;
import sparkminds.librarymanagement.loan.dto.RenewBorrowRequest;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BorrowRenewalService {
    private final BorrowRetryExecutor retryExecutor;
    private final BorrowMemberLockService memberLocks;
    private final LoanRepository loanRepository;
    private final LoanItemRepository itemRepository;
    private final BookRepository bookRepository;
    private final BorrowAuditService auditService;
    private final LoanAggregateService aggregateService;
    private final BorrowNotificationRepository notificationRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public BorrowRenewalResponse renew(Integer accountId, String code, Integer itemId, RenewBorrowRequest request) {
        return retryExecutor.execute(() -> renewAttempt(accountId, code, itemId, request));
    }

    /** Cùng khóa Book với enqueue/promotion; không thể kiểm tra queue rỗng rồi gia hạn qua một lượt chờ đã commit. */
    private BorrowRenewalResponse renewAttempt(Integer accountId, String code, Integer itemId, RenewBorrowRequest request) {
        var member = memberLocks.lock(accountId, true);
        var loan = loanRepository.findOwnedByCode(accountId, code).orElseThrow(BorrowQueryService::notFound);
        var item = itemRepository.findById(itemId).filter(value -> value.getLoan().getId().equals(loan.getId()))
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "BORROW_ITEM_NOT_FOUND", "Không tìm thấy sách trong yêu cầu"));
        var book = bookRepository.findByIdForUpdate(item.getBook().getId()).orElseThrow(BorrowQueryService::notFound);
        entityManager.refresh(book, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(item);
        if (item.getVersion() != request.expectedItemVersion()) {
            throw conflict("BORROW_VERSION_CONFLICT", "Thông tin sách đã thay đổi, hãy tải lại trước khi gia hạn");
        }
        LocalDate today = LocalDate.now(clock);
        if (item.getStatus() != LoanItemStatus.BORROWED || item.getRenewalCount() != 0
                || today.isAfter(item.getDueDate()) || today.isBefore(item.getDueDate().minusDays(3))) {
            throw conflict("BORROW_RENEWAL_NOT_ALLOWED", "Chỉ gia hạn một lần trong ba ngày trước hạn đến hết ngày đến hạn");
        }
        if (itemRepository.countByBookIdAndStatus(book.getId(), LoanItemStatus.WAITLISTED) > 0) {
            throw conflict("BORROW_WAITLIST_EXISTS", "Đầu sách đang có người chờ, không thể gia hạn");
        }
        item.setDueDate(item.getDueDate().plusDays(7));
        item.setRenewalCount((byte) 1);
        notificationRepository.supersedeOldReminders(itemId, item.getDueDate());
        auditService.append(item, LoanItemStatus.BORROWED, LoanItemEventReason.RENEWAL_COMPLETED, member.getAccount(), null, null);
        aggregateService.refresh(Set.of(loan.getId()));
        return new BorrowRenewalResponse(item.getId(), item.getStatus(), item.getDueDate(), item.getRenewalCount(), item.getVersion());
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
