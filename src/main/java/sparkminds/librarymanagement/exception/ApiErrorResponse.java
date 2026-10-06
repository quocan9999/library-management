package sparkminds.librarymanagement.exception;

import java.time.Instant;
import java.util.List;

public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String code,
        String message,
        List<ApiValidationError> errors) {

    public ApiErrorResponse {
        errors = errors == null ? List.of() : List.copyOf(errors);
    }
}
