package sparkminds.librarymanagement.member.service;

import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.dto.MemberAccountStatusRequest;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.repository.MemberRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.service.BorrowPolicy;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class MemberAccountStatusService {

    private final MemberRepository memberRepository;
    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final MemberQueryService memberQueryService;
    private final Clock clock;
    private final LoanItemRepository loanItemRepository;
    private final EntityManager entityManager;

    /**
     * Khóa Account → Member như Borrow create; READ_COMMITTED đếm lại activity sau khi chờ khóa.
     * Chỉ thu hồi session sau khi đủ điều kiện và CAS thành công trong cùng commit.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MemberDetailResponse updateStatus(Integer memberId, MemberAccountStatusRequest request) {
        if (memberId == null || memberId <= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "MEMBER_ID_INVALID", "Mã thành viên không hợp lệ");
        }
        if (request.expectedEnabled().equals(request.enabled())) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEMBER_ACCOUNT_STATUS_INVALID",
                    "Trạng thái đích phải khác trạng thái hiện tại"
            );
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên"));
        Integer accountId = member.getAccount().getId();
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy tài khoản thành viên"));
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        member = memberRepository.findByIdForUpdate(memberId).orElseThrow(() -> new BusinessException(
                HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên"));
        entityManager.refresh(member, LockModeType.PESSIMISTIC_WRITE);
        if (!"USER".equals(account.getRole().getCode())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên");
        }

        if (!request.enabled() && loanItemRepository.countByLoanMemberIdAndStatusIn(
                memberId, BorrowPolicy.ACTIVE_STATUSES) > 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "MEMBER_HAS_ACTIVE_BORROW_ACTIVITY",
                    "Không thể vô hiệu hóa thành viên còn hoạt động mượn sách");
        }

        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        int changed = accountRepository.updateStatusAndAdvanceSessionVersion(
                accountId, request.expectedEnabled(), request.enabled(),
                request.enabled() ? "ACCOUNT_ENABLED" : "ACCOUNT_DISABLED", now);
        if (changed != 1) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "MEMBER_ACCOUNT_STATUS_CONFLICT",
                    "Trạng thái tài khoản đã được cập nhật. Hãy tải lại hồ sơ."
            );
        }

        // Cập nhật quyền dùng phiên và thu hồi refresh token trong cùng giao dịch, để mọi thiết bị cùng mất phiên sau commit.
        refreshTokenRepository.revokeActiveByAccountId(accountId, now);
        return memberQueryService.getMember(memberId);
    }
}
