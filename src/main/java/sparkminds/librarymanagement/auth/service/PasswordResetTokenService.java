package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.PasswordResetToken;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class PasswordResetTokenService {

    private static final int TOKEN_BYTES = 32;

    private final Clock clock;
    private final SecureRandom secureRandom;
    private final VerificationTokenService verificationTokenService;

    public IssuedToken issue(Account account) {
        byte[] tokenBytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        PasswordResetToken token = new PasswordResetToken();
        token.setAccount(account);
        token.setTokenHash(verificationTokenService.hash(rawToken));
        token.setExpiresAt(LocalDateTime.now(clock).plusMinutes(30));
        return new IssuedToken(rawToken, token);
    }

    public String hash(String rawToken) {
        return verificationTokenService.hash(rawToken);
    }

    public record IssuedToken(String rawToken, PasswordResetToken token) {
    }
}
