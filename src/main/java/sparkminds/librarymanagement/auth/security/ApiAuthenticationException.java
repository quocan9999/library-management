package sparkminds.librarymanagement.auth.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;

public class ApiAuthenticationException extends AuthenticationException {
    private final HttpStatus status;
    private final String code;

    public ApiAuthenticationException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
