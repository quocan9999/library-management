package sparkminds.librarymanagement.security.jwt;

import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Service;

import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import sparkminds.librarymanagement.security.userdetails.AccountPrincipal;

@Service
public class JwtService {

    private final JwtProperties properties;
    private final SecretKey signingKey;
    private final JwtParser parser;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(properties.getSecretBase64()));
        this.parser = Jwts.parser().verifyWith(signingKey).build();
    }

    public String createAccessToken(AccountPrincipal principal) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(properties.getAccessTokenValiditySeconds());
        return Jwts.builder()
                .subject(principal.getUsername())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();
    }

    public String extractSubject(String token) {
        String subject = parser.parseSignedClaims(token).getPayload().getSubject();
        if (subject == null || subject.isBlank()) {
            throw new MalformedJwtException("JWT subject is required");
        }
        return subject;
    }

    public long getAccessTokenValiditySeconds() {
        return properties.getAccessTokenValiditySeconds();
    }
}
