package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.security.EffectivePermissionService;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StaffBorrowLockService {
    private final AccountRepository accountRepository;
    private final EffectivePermissionService permissions;
    private final BorrowMemberLockService memberLockService;
    private final LoanRepository loanRepository;
    private final LoanItemRepository itemRepository;
    private final BookRepository bookRepository;
    private final EntityManager entityManager;

    /** Tái kiểm tra quyền thật trong mỗi attempt; QR và tên Role không bao giờ tự cấp quyền. */
    public Account actor(Integer actorId, String... requiredPermissions) {
        Account actor = accountRepository.findById(actorId).orElseThrow(this::denied);
        entityManager.refresh(actor);
        entityManager.refresh(actor.getRole());
        if (!actor.isEnabled() || !actor.getRole().isEnabled() || RoleAccessPolicy.USER.equals(actor.getRole().getCode())
                || !permissions.resolveCurrentRoleCode(actor.getRole().getCode()).containsAll(List.of(requiredPermissions))) {
            throw denied();
        }
        return actor;
    }

    /** Khóa owner Account→Member, rồi toàn bộ Book tăng dần; không khóa Loan trước Book để tránh đảo thứ tự promotion. */
    public Context lock(String code, boolean verifyOwnerEmail) {
        Loan loan = loanRepository.findByLoanCode(code).orElseThrow(BorrowQueryService::notFound);
        memberLockService.lock(loan.getMember().getAccount().getId(), verifyOwnerEmail);
        List<LoanItem> items = itemRepository.findWithBookByLoanId(loan.getId());
        var books = items.stream().map(item -> item.getBook().getId()).distinct().sorted()
                .map(id -> bookRepository.findByIdForUpdate(id).orElseThrow(BorrowQueryService::notFound)).toList();
        for (Book book : books) entityManager.refresh(book, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(loan);
        for (LoanItem item : items) entityManager.refresh(item);
        return new Context(loan, items);
    }

    private BusinessException denied() {
        return new BusinessException(HttpStatus.FORBIDDEN, "PERMISSION_DENIED", "Bạn không có quyền thực hiện thao tác này");
    }

    public record Context(Loan loan, List<LoanItem> items) {
        public LoanItem item(Integer id) {
            return items.stream().filter(item -> item.getId().equals(id)).findFirst().orElseThrow(() ->
                    new BusinessException(HttpStatus.NOT_FOUND, "BORROW_ITEM_NOT_FOUND", "Không tìm thấy sách trong yêu cầu"));
        }
    }
}
