package sparkminds.librarymanagement.auth.service;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class RefreshCookieFactory {

    public static final String NAME = "refreshToken";
    public static final String PATH = "/api/v1/auth";
    private static final Duration MAX_AGE = Duration.ofDays(7);

    public ResponseCookie create(String token) {
        return ResponseCookie.from(NAME, token)
                .httpOnly(true)
                .sameSite("Strict")
                .path(PATH)
                .maxAge(MAX_AGE)
                .build();
    }

    public ResponseCookie clear() {
        return ResponseCookie.from(NAME, "")
                .httpOnly(true)
                .sameSite("Strict")
                .path(PATH)
                .maxAge(Duration.ZERO)
                .build();
    }
}
