package sparkminds.librarymanagement.config.aop;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import sparkminds.librarymanagement.config.exception.MaintenanceModeException;
import sparkminds.librarymanagement.config.service.SystemConfigService;

import java.util.List;

/**
 * Aspect kiểm tra và thực thi chế độ bảo trì hệ thống (AOP).
 * Khi chế độ bảo trì BẬT: chặn tất cả API nghiệp vụ gọi lên hệ thống,
 * ngoại trừ danh sách trắng (Whitelist) các endpoint thiết yếu phục vụ quản trị và duy trì phiên:
 * - /api/v1/system-configs/** (xem và tắt/bật bảo trì)
 * - /api/v1/auth/me (lấy thông tin phiên hiện tại cho admin layout)
 * - /api/v1/auth/refresh (làm mới access token cho admin)
 * - /api/v1/auth/logout (đăng xuất an toàn)
 * - /api/v1/auth/login (đăng nhập quản trị viên; độc giả bị chặn tại tầng service)
 * - /error (servlet error dispatcher của Spring Boot)
 */
@Aspect
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class MaintenanceModeAspect {

    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    private static final List<String> WHITELISTED_PATTERNS = List.of(
            "/api/v1/system-configs/**",
            "/api/v1/auth/me",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout",
            "/api/v1/auth/login",
            "/error"
    );

    private final SystemConfigService systemConfigService;

    @Around("within(@org.springframework.web.bind.annotation.RestController *)")
    public Object enforceMaintenanceMode(ProceedingJoinPoint joinPoint) throws Throwable {
        if (!systemConfigService.isMaintenanceActive()) {
            return joinPoint.proceed();
        }

        HttpServletRequest request = getCurrentHttpRequest();
        String uri = request != null ? request.getRequestURI() : "";

        if (isWhitelisted(uri)) {
            return joinPoint.proceed();
        }

        // Chặn toàn bộ tất cả API ngoài whitelist khi bảo trì đang bật
        log.warn("Maintenance mode active: blocked API request to uri={}", uri);
        throw new MaintenanceModeException(systemConfigService.getMaintenanceMessage());
    }

    private boolean isWhitelisted(String uri) {
        if (uri == null || uri.isBlank()) return false;
        return WHITELISTED_PATTERNS.stream().anyMatch(pattern -> PATH_MATCHER.match(pattern, uri));
    }

    private HttpServletRequest getCurrentHttpRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        return null;
    }
}
