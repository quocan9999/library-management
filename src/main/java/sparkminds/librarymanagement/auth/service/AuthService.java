package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.dto.LoginRequest;
import sparkminds.librarymanagement.auth.dto.LoginResponse;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.RefreshToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.security.jwt.IssuedJwtToken;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenService jwtTokenService;
    private final EntityManager entityManager;

    @Transactional
    public LoginResult login(LoginRequest request) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(
                            normalizeEmailIdentifier(request.identifier()), request.password())
            );
        } catch (DisabledException exception) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "AUTH_ACCOUNT_DISABLED", "Tài khoản hiện không thể đăng nhập");
        } catch (AuthenticationException exception) {
            throw new BusinessException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTH_INVALID_CREDENTIALS",
                    "Email/username hoặc mật khẩu không chính xác"
            );
        }

        CustomUserPrincipal principal = (CustomUserPrincipal) authentication.getPrincipal();
        Account account = accountRepository.findByIdForUpdate(principal.getAccountId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED,
                        "AUTH_INVALID_CREDENTIALS",
                        "Email/username hoặc mật khẩu không chính xác"
                ));
        // AuthenticationManager đã nạp Account trước khi khóa; refresh đảm bảo login dùng enabled/version mới nhất từ DB.
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);

        if (!account.isEnabled()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "AUTH_ACCOUNT_DISABLED", "Tài khoản hiện không thể đăng nhập");
        }

        if ("USER".equals(account.getRole().getCode()) && !account.isEmailVerified()) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "EMAIL_NOT_VERIFIED",
                    "Email chưa được xác thực. Vui lòng xác thực email trước khi đăng nhập."
            );
        }

        IssuedJwtToken accessToken = jwtTokenService.issue(
                account.getId(), account.getSessionVersion(), JwtTokenType.ACCESS);
        IssuedJwtToken refreshToken = jwtTokenService.issue(
                account.getId(), account.getSessionVersion(), JwtTokenType.REFRESH);

        RefreshToken metadata = new RefreshToken();
        metadata.setAccount(account);
        metadata.setJti(refreshToken.jti());
        metadata.setExpiresAt(LocalDateTime.ofInstant(refreshToken.expiresAt(), ZoneOffset.UTC));
        refreshTokenRepository.save(metadata);

        LoginResponse response = new LoginResponse(
                accessToken.value(),
                "Bearer",
                jwtTokenService.expiresInSeconds(JwtTokenType.ACCESS)
        );
        return new LoginResult(response, refreshToken.value());
    }

    private static String normalizeEmailIdentifier(String identifier) {
        if (!identifier.contains("@")) {
            return identifier;
        }
        return identifier.trim().toLowerCase(Locale.ROOT);
    }
}
