package sparkminds.librarymanagement.auth.service;

import org.junit.jupiter.api.Test;
import sparkminds.librarymanagement.auth.entity.Account;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordResetTokenServiceTests {

    @Test
    void issuesDistinctFortyThreeCharacterTokensWithOnlyTheirSha256HashesPersisted() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-13T12:30:00Z"), ZoneOffset.UTC);
        SecureRandom secureRandom = new SecureRandom();
        VerificationTokenService hashService = new VerificationTokenService(clock, secureRandom);
        PasswordResetTokenService tokenService = new PasswordResetTokenService(clock, secureRandom, hashService);
        Account account = new Account();

        PasswordResetTokenService.IssuedToken first = tokenService.issue(account);
        PasswordResetTokenService.IssuedToken second = tokenService.issue(account);

        assertThat(first.rawToken()).matches("[A-Za-z0-9_-]{43}").isNotEqualTo(second.rawToken());
        assertThat(first.token().getAccount()).isSameAs(account);
        assertThat(first.token().getTokenHash()).isEqualTo(hashService.hash(first.rawToken()));
        assertThat(first.token().getTokenHash()).isNotEqualTo(first.rawToken());
        assertThat(first.token().getExpiresAt()).isEqualTo(LocalDateTime.now(clock).plusMinutes(30));
    }
}
