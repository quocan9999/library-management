package sparkminds.librarymanagement.profile.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.dto.MemberProfilePatchRequest;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.repository.MemberRepository;
import sparkminds.librarymanagement.member.service.MemberProfileService;
import sparkminds.librarymanagement.profile.dto.UserProfileResponse;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final AccountRepository accountRepository;
    private final MemberRepository memberRepository;
    private final MemberProfileService memberProfileService;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(CustomUserPrincipal principal) {
        Account account = accountRepository.findById(principal.getAccountId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));

        Optional<Member> memberOptional = memberRepository.findByAccountId(account.getId());
        if (memberOptional.isPresent()) {
            Member member = memberOptional.get();
            return new UserProfileResponse(
                    account.getId(),
                    account.getUsername(),
                    account.getEmail(),
                    account.getRole().getCode(),
                    member.getId(),
                    member.getMemberCode(),
                    member.getFullName(),
                    member.getDateOfBirth(),
                    member.getPhone(),
                    member.getAddress(),
                    member.getVersion()
            );
        }

        return new UserProfileResponse(
                account.getId(),
                account.getUsername(),
                account.getEmail(),
                account.getRole().getCode(),
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    @Transactional
    public UserProfileResponse patchProfile(CustomUserPrincipal principal, MemberProfilePatchRequest request) {
        Account account = accountRepository.findById(principal.getAccountId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));

        Member member = memberRepository.findByAccountId(account.getId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Không tìm thấy hồ sơ thành viên"));

        MemberDetailResponse detail = memberProfileService.patchProfile(member.getId(), request);

        return new UserProfileResponse(
                account.getId(),
                account.getUsername(),
                account.getEmail(),
                account.getRole().getCode(),
                detail.id(),
                detail.memberCode(),
                detail.fullName(),
                detail.dateOfBirth(),
                detail.phone(),
                detail.address(),
                detail.version()
        );
    }
}
