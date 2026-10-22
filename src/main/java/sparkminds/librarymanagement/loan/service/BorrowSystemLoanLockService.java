package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;
import sparkminds.librarymanagement.member.repository.MemberRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BorrowSystemLoanLockService {
    private final LoanRepository loanRepository;
    private final AccountRepository accountRepository;
    private final MemberRepository memberRepository;
    private final LoanItemRepository itemRepository;
    private final BookRepository bookRepository;
    private final EntityManager entityManager;

    /** Job khóa theo cùng thứ tự nghiệp vụ nhưng vẫn giải phóng hold nếu tài khoản đã bị vô hiệu hóa. */
    public Context lock(Integer loanId) {
        Loan loan = loanRepository.findById(loanId).orElse(null);
        if (loan == null) return null;
        Integer memberId = loan.getMember().getId();
        Integer accountId = loan.getMember().getAccount().getId();
        var account = accountRepository.findByIdForUpdate(accountId).orElse(null);
        if (account == null) return null;
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        var member = memberRepository.findByIdForUpdate(memberId).orElse(null);
        if (member == null) return null;
        entityManager.refresh(member, LockModeType.PESSIMISTIC_WRITE);
        List<LoanItem> items = itemRepository.findWithBookByLoanId(loanId);
        var books = items.stream().map(item -> item.getBook().getId()).distinct().sorted()
                .map(id -> bookRepository.findByIdForUpdate(id).orElseThrow()).toList();
        books.forEach(book -> entityManager.refresh(book, LockModeType.PESSIMISTIC_WRITE));
        loan = loanRepository.findByIdForUpdate(loanId).orElse(null);
        if (loan == null) return null;
        entityManager.refresh(loan, LockModeType.PESSIMISTIC_WRITE);
        items.forEach(entityManager::refresh);
        return new Context(loan, items);
    }

    public record Context(Loan loan, List<LoanItem> items) {
    }
}
