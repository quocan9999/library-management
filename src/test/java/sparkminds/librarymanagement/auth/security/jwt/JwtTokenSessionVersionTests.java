package sparkminds.librarymanagement.auth.security.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenSessionVersionTests {

    private static final String SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Test
    void newlyIssuedTokensCarryNumericSessionVersionClaim() {
        Instant now = Instant.parse("2026-10-12T00:00:00Z");
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        JwtTokenService service = new JwtTokenService(
                new JwtProperties(SECRET, Duration.ofMinutes(15), Duration.ofDays(7)), clock);

        String token = service.issue(12, 0, JwtTokenType.ACCESS).value();
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET));
        Claims claims = Jwts.parser().verifyWith(key).clock(() -> Date.from(now)).build()
                .parseSignedClaims(token).getPayload();

        assertThat(claims.get("sessionVersion")).isInstanceOf(Number.class).isEqualTo(0);
    }

    @Test
    void verifiedTokenExposesNumericSessionVersionAsLong() {
        JwtTokenService service = service();

        VerifiedJwtToken verified = service.verify(token(7L, true), JwtTokenType.ACCESS);

        assertThat(verified.sessionVersion()).isEqualTo(7L);
    }

    @Test
    void rejectsLegacyJwtWithoutSessionVersionClaim() {
        assertThatThrownBy(() -> service().verify(token(null, false), JwtTokenType.ACCESS))
                .isInstanceOf(InvalidJwtTokenException.class);
    }

    @Test
    void rejectsStringAndFractionalSessionVersionClaims() {
        assertThatThrownBy(() -> service().verify(token("7", true), JwtTokenType.ACCESS))
                .isInstanceOf(InvalidJwtTokenException.class);
        assertThatThrownBy(() -> service().verify(token(7.5, true), JwtTokenType.ACCESS))
                .isInstanceOf(InvalidJwtTokenException.class);
    }

    private static JwtTokenService service() {
        return new JwtTokenService(new JwtProperties(
                SECRET, Duration.ofMinutes(15), Duration.ofDays(7)), Clock.systemUTC());
    }

    private static String token(Object sessionVersion, boolean includeSessionVersion) {
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        var builder = Jwts.builder()
                .subject("12")
                .id(UUID.randomUUID().toString())
                .claim("type", "ACCESS")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(60)));
        if (includeSessionVersion) builder.claim("sessionVersion", sessionVersion);
        return builder.signWith(Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET)), Jwts.SIG.HS256).compact();
    }
}
