package sparkminds.librarymanagement.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.repository.MemberLoanHistoryRepository;
import sparkminds.librarymanagement.member.repository.MemberRepository;
import sparkminds.librarymanagement.role.policy.RoleAccessPolicy;

@Service
@RequiredArgsConstructor
public class MemberDeletionTransactionService {

    private final MemberRepository memberRepository;
    private final AccountRepository accountRepository;
    private final MemberLoanHistoryRepository loanHistoryRepository;

    @Transactional
    public void deleteMember(Integer memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên"));
        if (!RoleAccessPolicy.USER.equals(member.getAccount().getRole().getCode())) {
            // Hồ sơ gắn với tài khoản quản trị không phải Member có thể bị xóa qua API này.
            throw new BusinessException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên");
        }
        if (loanHistoryRepository.existsForMember(memberId)) {
            throw historyConflict();
        }

        Account account = member.getAccount();
        memberRepository.delete(member);
        // Flush trong cùng transaction để FK RESTRICT chặn lịch sử mượn vừa phát sinh đồng thời.
        memberRepository.flush();
        accountRepository.delete(account);
        accountRepository.flush();
    }

    static BusinessException historyConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "MEMBER_HAS_LOAN_HISTORY",
                "Không thể xóa thành viên đã có lịch sử mượn sách"
        );
    }
}
