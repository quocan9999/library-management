package sparkminds.librarymanagement.auth.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import sparkminds.librarymanagement.auth.dto.LoginRequest;
import sparkminds.librarymanagement.auth.dto.LoginResponse;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.security.jwt.IssuedJwtToken;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;
import sparkminds.librarymanagement.config.exception.MaintenanceModeException;
import sparkminds.librarymanagement.config.service.SystemConfigService;

import java.time.Instant;
import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceMaintenanceLoginTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private JwtTokenService jwtTokenService;

    @Mock
    private EntityManager entityManager;

    @Mock
    private SystemConfigService systemConfigService;

    @InjectMocks
    private AuthService authService;

    private Account readerAccount;
    private Account adminAccount;
    private CustomUserPrincipal readerPrincipal;
    private CustomUserPrincipal adminPrincipal;

    @BeforeEach
    void setUp() {
        Role userRole = new Role();
        userRole.setCode("USER");
        userRole.setDisplayName("Độc giả");

        readerAccount = new Account();
        readerAccount.setId(10);
        readerAccount.setUsername("reader_user");
        readerAccount.setEmail("reader@example.com");
        readerAccount.setEnabled(true);
        readerAccount.setEmailVerified(true);
        readerAccount.setRole(userRole);

        readerPrincipal = CustomUserPrincipal.from(readerAccount, Collections.emptyList());

        Role adminRole = new Role();
        adminRole.setCode("ADMIN");
        adminRole.setDisplayName("Quản trị viên");

        adminAccount = new Account();
        adminAccount.setId(1);
        adminAccount.setUsername("admin_user");
        adminAccount.setEmail("admin@example.com");
        adminAccount.setEnabled(true);
        adminAccount.setEmailVerified(true);
        adminAccount.setRole(adminRole);

        adminPrincipal = CustomUserPrincipal.from(adminAccount, Collections.emptyList());
    }

    @Test
    @DisplayName("Khi bảo trì BẬT, độc giả (USER) đăng nhập bị chặn ngay lập tức và ném MaintenanceModeException")
    void whenMaintenanceOn_readerLogin_isBlocked() {
        LoginRequest request = new LoginRequest("reader_user", "password123");
        Authentication auth = new UsernamePasswordAuthenticationToken(readerPrincipal, "password123");

        when(authenticationManager.authenticate(any())).thenReturn(auth);
        when(accountRepository.findByIdForUpdate(10)).thenReturn(Optional.of(readerAccount));
        when(systemConfigService.isMaintenanceActive()).thenReturn(true);
        when(systemConfigService.isBypassedRole("USER")).thenReturn(false);
        when(systemConfigService.getMaintenanceMessage()).thenReturn("Hệ thống đang bảo trì, vui lòng quay lại sau.");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(MaintenanceModeException.class)
                .hasMessage("Hệ thống đang bảo trì, vui lòng quay lại sau.");

        verifyNoInteractions(jwtTokenService);
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    @DisplayName("Khi bảo trì BẬT, quản trị viên (ADMIN) vẫn được phép đăng nhập bình thường")
    void whenMaintenanceOn_adminLogin_isAllowed() {
        LoginRequest request = new LoginRequest("admin_user", "password123");
        Authentication auth = new UsernamePasswordAuthenticationToken(adminPrincipal, "password123");

        when(authenticationManager.authenticate(any())).thenReturn(auth);
        when(accountRepository.findByIdForUpdate(1)).thenReturn(Optional.of(adminAccount));
        when(systemConfigService.isMaintenanceActive()).thenReturn(true);
        when(systemConfigService.isBypassedRole("ADMIN")).thenReturn(true);

        Instant now = Instant.now();
        IssuedJwtToken accessToken = new IssuedJwtToken("access-token-xyz", "jti-1", now.plusSeconds(900));
        IssuedJwtToken refreshToken = new IssuedJwtToken("refresh-token-xyz", "jti-2", now.plusSeconds(86400));

        when(jwtTokenService.issue(eq(1), anyLong(), eq(JwtTokenType.ACCESS))).thenReturn(accessToken);
        when(jwtTokenService.issue(eq(1), anyLong(), eq(JwtTokenType.REFRESH))).thenReturn(refreshToken);

        LoginResult result = authService.login(request);

        assertThat(result).isNotNull();
        assertThat(result.response().accessToken()).isEqualTo("access-token-xyz");
        assertThat(result.refreshToken()).isEqualTo("refresh-token-xyz");
        verify(refreshTokenRepository).save(any());
    }

    @Test
    @DisplayName("Khi bảo trì TẮT, độc giả (USER) đăng nhập bình thường")
    void whenMaintenanceOff_readerLogin_isAllowed() {
        LoginRequest request = new LoginRequest("reader_user", "password123");
        Authentication auth = new UsernamePasswordAuthenticationToken(readerPrincipal, "password123");

        when(authenticationManager.authenticate(any())).thenReturn(auth);
        when(accountRepository.findByIdForUpdate(10)).thenReturn(Optional.of(readerAccount));
        when(systemConfigService.isMaintenanceActive()).thenReturn(false);

        Instant now = Instant.now();
        IssuedJwtToken accessToken = new IssuedJwtToken("access-token-reader", "jti-3", now.plusSeconds(900));
        IssuedJwtToken refreshToken = new IssuedJwtToken("refresh-token-reader", "jti-4", now.plusSeconds(86400));

        when(jwtTokenService.issue(eq(10), anyLong(), eq(JwtTokenType.ACCESS))).thenReturn(accessToken);
        when(jwtTokenService.issue(eq(10), anyLong(), eq(JwtTokenType.REFRESH))).thenReturn(refreshToken);

        LoginResult result = authService.login(request);

        assertThat(result).isNotNull();
        assertThat(result.response().accessToken()).isEqualTo("access-token-reader");
        verify(refreshTokenRepository).save(any());
    }
}
