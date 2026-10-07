package sparkminds.librarymanagement.auth.security.jwt;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secretBase64,
        Duration accessTokenTtl,
        Duration refreshTokenTtl
) {
}
