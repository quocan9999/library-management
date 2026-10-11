package sparkminds.librarymanagement.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Base64;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import sparkminds.librarymanagement.auth.entity.Account;

class VerificationTokenServiceTests {

    private static final Instant NOW = Instant.parse("2026-10-11T12:00:00Z");

    @Test
    void issuesUrlSafeTokenWithThirtyMinuteExpiryAndPersistsOnlySha256() throws Exception {
        var service = new VerificationTokenService(
                Clock.fixed(NOW, ZoneOffset.UTC), new java.security.SecureRandom());
        var account = new Account();

        var issued = service.issue(account);
        var rawBytes = Base64.getUrlDecoder().decode(issued.rawToken());
        var expectedHash = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(issued.rawToken().getBytes(StandardCharsets.UTF_8)));

        assertThat(rawBytes).hasSize(32);
        assertThat(issued.rawToken()).matches("^[A-Za-z0-9_-]+$");
        assertThat(issued.token().getTokenHash()).isNotEqualTo(issued.rawToken());
        assertThat(issued.token().getTokenHash()).isEqualTo(expectedHash);
        assertThat(issued.token().getAccount()).isSameAs(account);
        assertThat(issued.token().getExpiresAt()).isEqualTo(LocalDateTime.ofInstant(NOW, ZoneOffset.UTC).plusMinutes(30));
    }

    @Test
    void hashesTheSameRawTokenToTheSameSha256HexValue() throws Exception {
        var service = new VerificationTokenService(
                Clock.fixed(NOW, ZoneOffset.UTC), new java.security.SecureRandom());
        var rawToken = UUID.randomUUID().toString();
        var expectedHash = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8)));

        assertThat(service.hash(rawToken)).isEqualTo(expectedHash);
    }
}
