package sparkminds.librarymanagement.auth.security.jwt;

public class InvalidJwtTokenException extends RuntimeException {
    public InvalidJwtTokenException() {
        super("Invalid JWT token");
    }

    public InvalidJwtTokenException(Throwable cause) {
        super("Invalid JWT token", cause);
    }
}
