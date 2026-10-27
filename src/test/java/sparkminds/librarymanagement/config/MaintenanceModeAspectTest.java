package sparkminds.librarymanagement.config;

import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import sparkminds.librarymanagement.config.aop.MaintenanceModeAspect;
import sparkminds.librarymanagement.config.exception.MaintenanceModeException;
import sparkminds.librarymanagement.config.service.SystemConfigService;

import java.util.List;

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

    @Test
    @DisplayName("Khi bảo trì BẬT, duy nhất endpoint /api/v1/system-configs được phép đi qua")
    void whenMaintenanceOn_systemConfigsEndpoint_allowed() throws Throwable {
        when(systemConfigService.isMaintenanceActive()).thenReturn(true);
        when(joinPoint.proceed()).thenReturn("config-result");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/system-configs");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        Object result = aspect.enforceMaintenanceMode(joinPoint);

        assertThat(result).isEqualTo("config-result");
        verify(joinPoint).proceed();
    }

    @Test
    @DisplayName("Khi bảo trì BẬT, user thông thường gọi /api/v1/books bị chặn hoàn toàn")
    void whenMaintenanceOn_normalUserBlocked() {
        when(systemConfigService.isMaintenanceActive()).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/books");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "reader", "pwd", List.of(new SimpleGrantedAuthority("book:read"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(() -> aspect.enforceMaintenanceMode(joinPoint))
                .isInstanceOf(MaintenanceModeException.class)
                .hasMessageContaining("chế độ bảo trì");

        verifyNoInteractions(joinPoint);
    }

    @Test
    @DisplayName("Khi bảo trì BẬT, kể cả Admin gọi /api/v1/admin/books cũng bị chặn (chặn tất cả)")
    void whenMaintenanceOn_adminCallingOtherEndpoints_isBlocked() {
        when(systemConfigService.isMaintenanceActive()).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/books");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "admin", "pwd", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(() -> aspect.enforceMaintenanceMode(joinPoint))
                .isInstanceOf(MaintenanceModeException.class)
                .hasMessageContaining("chế độ bảo trì");

        verifyNoInteractions(joinPoint);
    }
}
