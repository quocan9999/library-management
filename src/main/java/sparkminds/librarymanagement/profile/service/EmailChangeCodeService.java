package sparkminds.librarymanagement.profile.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailChangeVerification;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EmailChangeCodeService {

    private static final long CODE_TTL_MINUTES = 10;

    private final SecureRandom secureRandom;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public IssuedCode issue(Account account, String newEmail) {
        String rawCode = String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
        EmailChangeVerification verification = new EmailChangeVerification();
        verification.setAccount(account);
        verification.setNewEmail(newEmail);
        verification.setCodeHash(passwordEncoder.encode(rawCode));
        verification.setExpiresAt(LocalDateTime.now(clock).plusMinutes(CODE_TTL_MINUTES));
        return new IssuedCode(rawCode, verification);
    }

    public boolean matches(String rawCode, String codeHash) {
        return passwordEncoder.matches(rawCode, codeHash);
    }

    public record IssuedCode(String rawCode, EmailChangeVerification verification) {
    }
}
