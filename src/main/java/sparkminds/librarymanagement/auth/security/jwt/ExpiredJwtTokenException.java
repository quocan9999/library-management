package sparkminds.librarymanagement.auth.security.jwt;

public class ExpiredJwtTokenException extends RuntimeException {
    public ExpiredJwtTokenException() {
        super("JWT token has expired");
    }
}
