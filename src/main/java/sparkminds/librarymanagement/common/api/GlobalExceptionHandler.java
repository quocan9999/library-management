package sparkminds.librarymanagement.common.api;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import sparkminds.librarymanagement.config.exception.MaintenanceModeException;
import sparkminds.librarymanagement.member.exception.MemberProfilePatchException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException exception) {
        return error(exception.getStatus(), exception.getCode(), exception.getMessage(), null);
    }

    @ExceptionHandler(MemberProfilePatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleMemberProfilePatch(MemberProfilePatchException exception) {
        return error(exception.getStatus(), exception.getCode(), exception.getMessage(), exception.getFieldErrors());
    }

    @ExceptionHandler(FieldValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleFieldValidation(FieldValidationException exception) {
        return error(exception.getStatus(), exception.getCode(), exception.getMessage(), exception.getFieldErrors());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException exception) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_BODY", "Nội dung yêu cầu không hợp lệ", null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidRequestParameter(MethodArgumentTypeMismatchException exception) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_PARAMETER", "Tham số yêu cầu không hợp lệ", null);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingRequestPart(MissingServletRequestPartException exception) {
        return error(HttpStatus.BAD_REQUEST, "MISSING_REQUEST_PART", "Thiếu file cần tải lên", null);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingRequestParameter(MissingServletRequestParameterException exception) {
        return error(HttpStatus.BAD_REQUEST, "MISSING_REQUEST_PARAMETER", "Thiếu tham số yêu cầu", null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUploadSize(MaxUploadSizeExceededException exception, HttpServletRequest request) {
        return uploadTooLarge(request);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMultipart(MultipartException exception, HttpServletRequest request) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof MaxUploadSizeExceededException) {
                return uploadTooLarge(request);
            }
        }
        return error(HttpStatus.BAD_REQUEST, "INVALID_MULTIPART_REQUEST", "Yêu cầu tải file không hợp lệ", null);
    }

    private ResponseEntity<ApiResponse<Void>> uploadTooLarge(HttpServletRequest request) {
        String code = request.getRequestURI().equals("/api/v1/books/import")
                ? "BOOK_IMPORT_FILE_TOO_LARGE" : "BOOK_COVER_TOO_LARGE";
        return error(HttpStatus.PAYLOAD_TOO_LARGE, code, "File tải lên vượt quá giới hạn cho phép", null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            errors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", errors);
    }

    @ExceptionHandler(MaintenanceModeException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaintenanceMode(MaintenanceModeException exception) {
        return error(
                HttpStatus.SERVICE_UNAVAILABLE,
                "MAINTENANCE_MODE_ACTIVE",
                exception.getMessage() != null ? exception.getMessage() : "Hệ thống đang trong chế độ bảo trì, vui lòng quay lại sau",
                null
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException exception) {
        return error(
                HttpStatus.FORBIDDEN,
                "PERMISSION_DENIED",
                "Bạn không có quyền truy cập tài nguyên này",
                null
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception exception) {
        return error(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Đã xảy ra lỗi hệ thống",
                null
        );
    }

    private ResponseEntity<ApiResponse<Void>> error(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> errors
    ) {
        return ResponseEntity.status(status)
                .body(ApiResponse.error(status.value(), code, message, errors));
    }
}
