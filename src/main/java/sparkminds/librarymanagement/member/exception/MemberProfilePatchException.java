package sparkminds.librarymanagement.member.exception;

import org.springframework.http.HttpStatus;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.util.Map;

public class MemberProfilePatchException extends BusinessException {
    private final Map<String, String> fieldErrors;

    public MemberProfilePatchException(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors
    ) {
        super(status, code, message);
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
