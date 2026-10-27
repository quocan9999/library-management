package sparkminds.librarymanagement.config.aop;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import sparkminds.librarymanagement.config.exception.MaintenanceModeException;
import sparkminds.librarymanagement.config.service.SystemConfigService;

/**
 * Aspect kiểm tra và thực thi chế độ bảo trì hệ thống (AOP).
 * Khi chế độ bảo trì BẬT: chặn TẤT CẢ API gọi lên hệ thống (cả độc giả và quản trị viên),
 * ngoại trừ DUY NHẤT API quản lý cấu hình bảo trì (/api/v1/system-configs/**) để có thể xem và tắt bảo trì.
 */
@Aspect
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class MaintenanceModeAspect {

    private final SystemConfigService systemConfigService;

    @Around("within(@org.springframework.web.bind.annotation.RestController *)")
    public Object enforceMaintenanceMode(ProceedingJoinPoint joinPoint) throws Throwable {
        if (!systemConfigService.isMaintenanceActive()) {
            return joinPoint.proceed();
        }

        HttpServletRequest request = getCurrentHttpRequest();
        String uri = request != null ? request.getRequestURI() : "";

        // Ngoại lệ DUY NHẤT: Cho phép API cấu hình để có thể kiểm tra trạng thái và tắt bảo trì
        if (uri.startsWith("/api/v1/system-configs")) {
            return joinPoint.proceed();
        }

        // Chặn toàn bộ tất cả API khác gọi lên hệ thống khi bảo trì đang bật
        log.warn("Maintenance mode active: blocked API request to uri={}", uri);
        throw new MaintenanceModeException("Hệ thống đang trong chế độ bảo trì. Vui lòng quay lại sau.");
    }

    private HttpServletRequest getCurrentHttpRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        return null;
    }
}
