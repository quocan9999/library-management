package sparkminds.librarymanagement.auth.security.jwt;

import java.time.Instant;
import java.util.UUID;

public record VerifiedJwtToken(
        Integer accountId,
        UUID jti,
        JwtTokenType type,
        Instant issuedAt,
        Instant expiresAt,
        long sessionVersion
) {
}
