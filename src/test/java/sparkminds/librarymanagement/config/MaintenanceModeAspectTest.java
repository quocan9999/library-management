package sparkminds.librarymanagement.config;

import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import sparkminds.librarymanagement.config.aop.MaintenanceModeAspect;
import sparkminds.librarymanagement.config.exception.MaintenanceModeException;
import sparkminds.librarymanagement.config.service.SystemConfigService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MaintenanceModeAspectTest {

    @Mock
    private SystemConfigService systemConfigService;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @InjectMocks
    private MaintenanceModeAspect aspect;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    @DisplayName("Khi chế độ bảo trì TẮT, request được thực thi bình thường")
    void whenMaintenanceOff_proceedsNormally() throws Throwable {
        when(systemConfigService.isMaintenanceActive()).thenReturn(false);
        when(joinPoint.proceed()).thenReturn("result");

        Object result = aspect.enforceMaintenanceMode(joinPoint);

        assertThat(result).isEqualTo("result");
        verify(joinPoint).proceed();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/system-configs",
            "/api/v1/system-configs/maintenance",
            "/api/v1/auth/me",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout",
            "/api/v1/auth/login",
            "/error"
    })
    @DisplayName("Khi bảo trì BẬT, các endpoint trong whitelist được phép đi qua")
    void whenMaintenanceOn_whitelistedEndpoints_allowed(String uri) throws Throwable {
        when(systemConfigService.isMaintenanceActive()).thenReturn(true);
        when(joinPoint.proceed()).thenReturn("whitelisted-ok");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        Object result = aspect.enforceMaintenanceMode(joinPoint);

        assertThat(result).isEqualTo("whitelisted-ok");
        verify(joinPoint).proceed();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/books",
            "/api/v1/catalog/books",
            "/api/v1/members",
            "/api/v1/borrow-requests",
            "/api/v1/admin/accounts",
            "/api/v1/auth/register",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
            "/api/v1/auth/verify-email",
            "/api/v1/auth/resend-verification"
    })
    @DisplayName("Khi bảo trì BẬT, các endpoint ngoài whitelist bị chặn hoàn toàn và trả về thông điệp bảo trì")
    void whenMaintenanceOn_nonWhitelistedEndpoints_blocked(String uri) {
        when(systemConfigService.isMaintenanceActive()).thenReturn(true);
        when(systemConfigService.getMaintenanceMessage()).thenReturn("Hệ thống đang bảo trì nâng cấp");

        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThatThrownBy(() -> aspect.enforceMaintenanceMode(joinPoint))
                .isInstanceOf(MaintenanceModeException.class)
                .hasMessage("Hệ thống đang bảo trì nâng cấp");

        verifyNoInteractions(joinPoint);
    }
}
