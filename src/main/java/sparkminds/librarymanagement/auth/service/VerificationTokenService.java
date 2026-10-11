package sparkminds.librarymanagement.auth.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;

import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailVerificationToken;

@Service
public class VerificationTokenService {

    private static final int TOKEN_BYTES = 32;
    private static final long TOKEN_TTL_MINUTES = 30;

    private final Clock clock;
    private final SecureRandom secureRandom;

    public VerificationTokenService(Clock clock, SecureRandom secureRandom) {
        this.clock = Objects.requireNonNull(clock);
        this.secureRandom = Objects.requireNonNull(secureRandom);
    }

    public IssuedToken issue(Account account) {
        byte[] tokenBytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        var token = new EmailVerificationToken();
        token.setAccount(account);
        token.setTokenHash(hash(rawToken));
        token.setExpiresAt(LocalDateTime.now(clock).plusMinutes(TOKEN_TTL_MINUTES));
        return new IssuedToken(rawToken, token);
    }

    public String hash(String rawToken) {
        Objects.requireNonNull(rawToken);
        // Chỉ lưu digest SHA-256 trong thực thể; token thô chỉ được giữ để tạo liên kết gửi email.
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record IssuedToken(String rawToken, EmailVerificationToken token) {
    }
}
