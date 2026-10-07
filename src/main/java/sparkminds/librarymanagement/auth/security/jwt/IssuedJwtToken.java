package sparkminds.librarymanagement.auth.security.jwt;

import java.time.Instant;

public record IssuedJwtToken(String value, String jti, Instant expiresAt) {
}
