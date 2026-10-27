package sparkminds.librarymanagement.config.aop;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Aspect ghi log chi tiết Request và Response cho tất cả API (AOP).
 * Sử dụng Log4j2 ghi đồng thời ra Console và File log hệ thống.
 */
@Aspect
@Component
@Order(2)
@Slf4j
public class ApiLoggingAspect {

    @Around("within(@org.springframework.web.bind.annotation.RestController *)")
    public Object logApiRequestAndResponse(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        HttpServletRequest request = getCurrentHttpRequest();

        String method = request != null ? request.getMethod() : "UNKNOWN";
        String uri = request != null ? request.getRequestURI() : joinPoint.getSignature().toShortString();
        String actor = getCurrentActor();
        Map<String, String> safeParams = getSafeParameters(request);

        log.info("HTTP REQUEST [{}] {} - actor={} params={}", method, uri, actor, safeParams);

        try {
            Object result = joinPoint.proceed();
            long durationMs = System.currentTimeMillis() - startTime;
            log.info("HTTP RESPONSE [{}] {} - outcome=SUCCESS durationMs={}", method, uri, durationMs);
            return result;
        } catch (Throwable ex) {
            long durationMs = System.currentTimeMillis() - startTime;
            log.error("HTTP ERROR [{}] {} - exception={} message={} durationMs={}",
                    method, uri, ex.getClass().getSimpleName(), ex.getMessage(), durationMs);
            throw ex;
        }
    }

    private HttpServletRequest getCurrentHttpRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        return null;
    }

    private String getCurrentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return "ANONYMOUS";
    }

    private Map<String, String> getSafeParameters(HttpServletRequest request) {
        Map<String, String> params = new LinkedHashMap<>();
        if (request == null) return params;

        Enumeration<String> parameterNames = request.getParameterNames();
        while (parameterNames.hasMoreElements()) {
            String name = parameterNames.nextElement();
            if (isSensitive(name)) {
                params.put(name, "******");
            } else {
                params.put(name, request.getParameter(name));
            }
        }
        return params;
    }

    private boolean isSensitive(String paramName) {
        String lower = paramName.toLowerCase();
        return lower.contains("password") || lower.contains("token") || lower.contains("secret");
    }
}
