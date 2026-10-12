package sparkminds.librarymanagement.auth.security.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.InvalidKeyException;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Set;
import java.util.UUID;

@Service
public class JwtTokenService {

    private static final Set<String> ALLOWED_CLAIMS = Set.of("sub", "jti", "type", "iat", "exp", "sessionVersion");
    private static final String ALGORITHM = "HS256";

    private final SecretKey signingKey;
    private final JwtProperties properties;
    private final Clock clock;

    public JwtTokenService(JwtProperties properties, Clock jwtClock) {
        this.properties = properties;
        this.clock = jwtClock;
        this.signingKey = decodeSigningKey(properties.secretBase64());
        requirePositive(properties.accessTokenTtl(), "access token TTL");
        requirePositive(properties.refreshTokenTtl(), "refresh token TTL");
    }

    public IssuedJwtToken issue(Integer accountId, long sessionVersion, JwtTokenType type) {
        if (accountId == null || accountId <= 0 || sessionVersion < 0 || type == null) {
            throw new IllegalArgumentException("A valid account and JWT type are required");
        }

        Instant issuedAt = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plus(ttlFor(type));
        String jti = UUID.randomUUID().toString();
        String value = Jwts.builder()
                .subject(accountId.toString())
                .id(jti)
                .claim("type", type.name())
                .claim("sessionVersion", sessionVersion)
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();

        return new IssuedJwtToken(value, jti, expiresAt);
    }

    public VerifiedJwtToken verify(String value, JwtTokenType expectedType) {
        if (value == null || value.isBlank() || expectedType == null) {
            throw new InvalidJwtTokenException();
        }

        try {
            Jws<Claims> parsed = Jwts.parser()
                    .verifyWith(signingKey)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(value);

            if (!ALGORITHM.equals(parsed.getHeader().get("alg"))) {
                throw new InvalidJwtTokenException();
            }
            Claims claims = parsed.getPayload();
            if (!claims.keySet().equals(ALLOWED_CLAIMS)) {
                throw new InvalidJwtTokenException();
            }

            int accountId = Integer.parseInt(claims.getSubject());
            UUID jti = UUID.fromString(claims.getId());
            JwtTokenType actualType = JwtTokenType.valueOf(claims.get("type", String.class));
            Instant issuedAt = claims.getIssuedAt().toInstant();
            Instant expiresAt = claims.getExpiration().toInstant();
            long sessionVersion = readSessionVersion(claims.get("sessionVersion"));
            if (accountId <= 0 || issuedAt.isAfter(clock.instant()) || !expiresAt.isAfter(issuedAt)
                    || actualType != expectedType) {
                throw new InvalidJwtTokenException();
            }
            return new VerifiedJwtToken(accountId, jti, actualType, issuedAt, expiresAt, sessionVersion);
        } catch (ExpiredJwtException exception) {
            throw new ExpiredJwtTokenException();
        } catch (InvalidJwtTokenException | ExpiredJwtTokenException exception) {
            throw exception;
        } catch (JwtException | IllegalArgumentException | NullPointerException exception) {
            throw new InvalidJwtTokenException(exception);
        }
    }

    public long expiresInSeconds(JwtTokenType type) {
        return ttlFor(type).toSeconds();
    }

    private Duration ttlFor(JwtTokenType type) {
        return type == JwtTokenType.ACCESS ? properties.accessTokenTtl() : properties.refreshTokenTtl();
    }

    private static long readSessionVersion(Object claim) {
        if (!(claim instanceof Number)) {
            throw new InvalidJwtTokenException();
        }
        try {
            long version = new BigDecimal(claim.toString()).longValueExact();
            if (version < 0) {
                throw new InvalidJwtTokenException();
            }
            return version;
        } catch (NumberFormatException | ArithmeticException exception) {
            throw new InvalidJwtTokenException(exception);
        }
    }

    private static SecretKey decodeSigningKey(String encodedSecret) {
        if (encodedSecret == null || encodedSecret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET_BASE64 must be configured");
        }
        try {
            byte[] keyBytes = Base64.getDecoder().decode(encodedSecret);
            if (keyBytes.length < 32) {
                throw new IllegalStateException("JWT_SECRET_BASE64 must decode to at least 32 bytes");
            }
            return Keys.hmacShaKeyFor(keyBytes);
        } catch (IllegalArgumentException | InvalidKeyException exception) {
            throw new IllegalStateException("JWT_SECRET_BASE64 is invalid or too short", exception);
        }
    }

    private static void requirePositive(Duration duration, String name) {
        if (duration == null || duration.isZero() || duration.isNegative() || duration.getNano() != 0) {
            throw new IllegalStateException("JWT " + name + " must be a positive whole number of seconds");
        }
    }
}
