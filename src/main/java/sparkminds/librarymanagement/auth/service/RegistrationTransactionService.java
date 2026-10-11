package sparkminds.librarymanagement.auth.service;

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
import sparkminds.librarymanagement.member.repository.MemberRepository;

@Service
public class RegistrationTransactionService {

    private final AccountRepository accountRepository;
    private final RoleRepositoy roleRepository;
    private final MemberRepository memberRepository;
    private final EmailVerificationTokenRepository verificationTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final VerificationTokenService verificationTokenService;
    private final ApplicationEventPublisher eventPublisher;

    public RegistrationTransactionService(
            AccountRepository accountRepository,
            RoleRepositoy roleRepository,
            MemberRepository memberRepository,
            EmailVerificationTokenRepository verificationTokenRepository,
            PasswordEncoder passwordEncoder,
            VerificationTokenService verificationTokenService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.accountRepository = accountRepository;
        this.roleRepository = roleRepository;
        this.memberRepository = memberRepository;
        this.verificationTokenRepository = verificationTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.verificationTokenService = verificationTokenService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void create(RegisterRequest request) {
        Account account = new Account();
        account.setEmail(request.email());
        account.setUsername(null);
        account.setPasswordHash(passwordEncoder.encode(request.password()));
        account.setRole(roleRepository.findByCode("ROLE_USER")
                .orElseThrow(() -> new IllegalStateException("ROLE_USER is not configured")));
        account.setEmailVerified(false);
        account.setEnabled(true);
        accountRepository.saveAndFlush(account);

        Member member = new Member();
        member.setAccount(account);
        // Gán mã tạm duy nhất để lấy ID; mã M cuối cùng thay thế trước khi transaction có thể commit.
        member.setMemberCode("TMPA" + account.getId());
        memberRepository.saveAndFlush(member);
        member.setMemberCode(memberCodeForId(member.getId()));
        memberRepository.saveAndFlush(member);

        VerificationTokenService.IssuedToken issuedToken = verificationTokenService.issue(account);
        verificationTokenRepository.saveAndFlush(issuedToken.token());

        // Sự kiện nằm trong transaction; listener chỉ gửi email sau khi toàn bộ dữ liệu đã commit.
        eventPublisher.publishEvent(new RegistrationMailRequested(request.email(), issuedToken.rawToken()));
    }

    public static String memberCodeForId(int memberId) {
        return "M" + String.format(Locale.ROOT, "%06d", memberId);
    }
}
