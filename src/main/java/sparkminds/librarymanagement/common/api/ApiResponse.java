package sparkminds.librarymanagement.common.api;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

public record ApiResponse<T>(
        boolean success,
        int status,
        String code,
        String message,
        T data,
        Map<String, String> errors,
        OffsetDateTime timestamp
) {
    public static <T> ApiResponse<T> success(int status, String code, String message, T data) {
        return new ApiResponse<>(true, status, code, message, data, null, OffsetDateTime.now(ZoneOffset.UTC));
    }

    public static ApiResponse<Void> error(int status, String code, String message, Map<String, String> errors) {
        return new ApiResponse<>(false, status, code, message, null, errors, OffsetDateTime.now(ZoneOffset.UTC));
    }
}
