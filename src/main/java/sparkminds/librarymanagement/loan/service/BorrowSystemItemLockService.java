package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.member.repository.MemberRepository;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BorrowSystemItemLockService {
    private final LoanItemRepository itemRepository;
    private final AccountRepository accountRepository;
    private final MemberRepository memberRepository;
    private final BookRepository bookRepository;
    private final EntityManager entityManager;

    /** Job vẫn phải giải phóng hold của account mất điều kiện; chỉ khóa theo thứ tự chung, không dùng eligibility của thao tác USER. */
    public Optional<LoanItem> lock(Integer itemId) {
        var found = itemRepository.findById(itemId);
        if (found.isEmpty()) return Optional.empty();
        var item = found.get();
        var member = item.getLoan().getMember();
        var account = accountRepository.findByIdForUpdate(member.getAccount().getId()).orElseThrow();
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        var lockedMember = memberRepository.findByIdForUpdate(member.getId()).orElseThrow();
        entityManager.refresh(lockedMember, LockModeType.PESSIMISTIC_WRITE);
        var book = bookRepository.findByIdForUpdate(item.getBook().getId()).orElseThrow();
        entityManager.refresh(book, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(item);
        return Optional.of(item);
    }
}
