package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class BorrowInventoryService {

    private final LoanItemRepository loanItemRepository;
    private final BorrowAuditService auditService;

    /**
     * Caller đã khóa Book trước khi gọi; không lọc eligibility của người đầu hàng và không thay fee snapshot.
     * Gom Loan bị ảnh hưởng để caller cập nhật aggregate sau khi đã xử lý toàn bộ Book theo thứ tự khóa.
     */
    public void allocateWaiting(Book book, Set<Integer> affectedLoans) {
        int available = book.getAvailableQuantity();
        if (available == 0) return;
        var waiting = loanItemRepository.findByBookIdAndStatusOrderByWaitlistedAtAscIdAsc(
                book.getId(), LoanItemStatus.WAITLISTED, PageRequest.of(0, available));
        for (var item : waiting) {
            item.setStatus(LoanItemStatus.RESERVED);
            book.setAvailableQuantity(book.getAvailableQuantity() - 1);
            affectedLoans.add(item.getLoan().getId());
            auditService.append(item, LoanItemStatus.WAITLISTED, LoanItemEventReason.QUEUE_PROMOTED, null, null, null);
        }
    }
}
