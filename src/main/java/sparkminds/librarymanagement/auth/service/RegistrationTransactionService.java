package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import java.util.Locale;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.dto.MemberRegistrationProfile;
import sparkminds.librarymanagement.member.repository.MemberRepository;

@Service
@RequiredArgsConstructor
public class RegistrationTransactionService {

    private final AccountRepository accountRepository;
    private final RoleRepositoy roleRepository;
    private final MemberRepository memberRepository;
    private final EmailVerificationTokenRepository verificationTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final VerificationTokenService verificationTokenService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Integer create(RegisterRequest request) {
        return create(request, MemberRegistrationProfile.empty());
    }

    @Transactional
    public Integer create(RegisterRequest request, MemberRegistrationProfile profile) {
        Account account = new Account();
        account.setEmail(request.email());
        account.setUsername(null);
        account.setPasswordHash(passwordEncoder.encode(request.password()));
        account.setRole(roleRepository.findByCode("USER")
                .orElseThrow(() -> new IllegalStateException("USER role is not configured")));
        account.setEmailVerified(false);
        account.setEnabled(true);
        accountRepository.saveAndFlush(account);

        Member member = new Member();
        member.setAccount(account);
        member.setFullName(profile.fullName());
        member.setDateOfBirth(profile.dateOfBirth());
        member.setPhone(profile.phone());
        member.setAddress(profile.address());
        // Gán mã tạm duy nhất để lấy ID; mã M cuối cùng thay thế trước khi transaction có thể commit.
        member.setMemberCode("TMPA" + account.getId());
        memberRepository.saveAndFlush(member);
        member.setMemberCode(memberCodeForId(member.getId()));
        memberRepository.saveAndFlush(member);

        VerificationTokenService.IssuedToken issuedToken = verificationTokenService.issue(account);
        verificationTokenRepository.saveAndFlush(issuedToken.token());

        // Sự kiện nằm trong transaction; listener chỉ gửi email sau khi toàn bộ dữ liệu đã commit.
        eventPublisher.publishEvent(new RegistrationMailRequested(request.email(), issuedToken.rawToken()));
        return member.getId();
    }

    public static String memberCodeForId(int memberId) {
        return "M" + String.format(Locale.ROOT, "%06d", memberId);
    }
}
