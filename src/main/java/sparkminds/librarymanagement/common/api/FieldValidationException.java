package sparkminds.librarymanagement.common.api;

import org.springframework.http.HttpStatus;

import java.util.Map;

public class FieldValidationException extends BusinessException {

    private final Map<String, String> fieldErrors;

    public FieldValidationException(HttpStatus status, String code, String message, Map<String, String> fieldErrors) {
        super(status, code, message);
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
