package sparkminds.librarymanagement.auth.web;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import sparkminds.librarymanagement.auth.service.InMemoryVerificationRateLimiter;
import sparkminds.librarymanagement.common.api.ApiResponse;

import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class ResendRateLimitInterceptor implements HandlerInterceptor {

    private final InMemoryVerificationRateLimiter rateLimiter;
    private final ObjectMapper objectMapper;

    /** Chạy trước khi MVC đọc/validate body để cả request sai định dạng cũng tính vào quota IP. */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        boolean forgotPassword = "/api/v1/auth/forgot-password".equals(request.getRequestURI());
        var result = forgotPassword
                ? rateLimiter.consumeForgotPasswordIpRequest(request.getRemoteAddr())
                : rateLimiter.consumeResendIpRequest(request.getRemoteAddr());
        if (result.allowed()) {
            return true;
        }

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(result.retryAfterSeconds()));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                forgotPassword ? "FORGOT_PASSWORD_RATE_LIMITED" : "RESEND_RATE_LIMITED",
                forgotPassword
                        ? "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau."
                        : "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.",
                null
        ));
        return false;
    }
}
