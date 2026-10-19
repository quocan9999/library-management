package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.repository.MemberRepository;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;

@Service
@RequiredArgsConstructor
public class BorrowMemberLockService {

    private final AccountRepository accountRepository;
    private final MemberRepository memberRepository;
    private final EntityManager entityManager;

    /** Account → Member luôn cùng thứ tự với vô hiệu hóa; đếm hạn mức chỉ sau khi đã khóa Member. */
    public Member lock(Integer accountId, boolean requireVerifiedEmail) {
        Account account = accountRepository.findByIdForUpdate(accountId).orElseThrow(this::ineligible);
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(account.getRole());
        if (!account.isEnabled() || !account.getRole().isEnabled()
                || !RoleAccessPolicy.USER.equals(account.getRole().getCode())
                || (requireVerifiedEmail && !account.isEmailVerified())) {
            throw ineligible();
        }
        Member member = memberRepository.findByAccountIdForUpdate(accountId).orElseThrow(this::ineligible);
        entityManager.refresh(member, LockModeType.PESSIMISTIC_WRITE);
        return member;
    }

    private BusinessException ineligible() {
        return new BusinessException(HttpStatus.FORBIDDEN, "BORROW_ACCOUNT_INELIGIBLE",
                "Tài khoản hoặc hồ sơ thành viên không đủ điều kiện mượn sách");
    }
}
