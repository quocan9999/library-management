package sparkminds.librarymanagement.auth.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RevokedAccessTokenRepository;
import sparkminds.librarymanagement.auth.security.jwt.ExpiredJwtTokenException;
import sparkminds.librarymanagement.auth.security.jwt.InvalidJwtTokenException;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;
import sparkminds.librarymanagement.auth.security.jwt.VerifiedJwtToken;

@Service
public class AccessTokenAuthenticationService {

    private final JwtTokenService jwtTokenService;
    private final RevokedAccessTokenRepository revokedAccessTokenRepository;
    private final AccountRepository accountRepository;
    private final EffectivePermissionService effectivePermissionService;

    public AccessTokenAuthenticationService(
            JwtTokenService jwtTokenService,
            RevokedAccessTokenRepository revokedAccessTokenRepository,
            AccountRepository accountRepository,
            EffectivePermissionService effectivePermissionService
    ) {
        this.jwtTokenService = jwtTokenService;
        this.revokedAccessTokenRepository = revokedAccessTokenRepository;
        this.accountRepository = accountRepository;
        this.effectivePermissionService = effectivePermissionService;
    }

    @Transactional(readOnly = true)
    public Authentication authenticate(String token) {
        VerifiedJwtToken verified;
        try {
            verified = jwtTokenService.verify(token, JwtTokenType.ACCESS);
        } catch (ExpiredJwtTokenException exception) {
            throw new ApiAuthenticationException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTH_TOKEN_EXPIRED",
                    "Access Token đã hết hạn"
            );
        } catch (InvalidJwtTokenException exception) {
            throw invalidToken();
        }

        if (revokedAccessTokenRepository.existsByJti(verified.jti().toString())) {
            throw new ApiAuthenticationException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTH_TOKEN_REVOKED",
                    "Access Token đã bị thu hồi"
            );
        }

        Account account = accountRepository.findById(verified.accountId())
                .orElseThrow(AccessTokenAuthenticationService::invalidToken);
        if (!account.isEnabled()) {
            throw new ApiAuthenticationException(
                    HttpStatus.FORBIDDEN,
                    "AUTH_ACCOUNT_DISABLED",
                    "Tài khoản hiện không thể đăng nhập"
            );
        }

        if (verified.sessionVersion() != account.getSessionVersion()) {
            throw invalidToken();
        }

        if ("ROLE_USER".equals(account.getRole().getCode()) && !account.isEmailVerified()) {
            throw new ApiAuthenticationException(
                    HttpStatus.FORBIDDEN,
                    "EMAIL_NOT_VERIFIED",
                    "Email chưa được xác thực. Vui lòng xác thực email trước khi đăng nhập."
            );
        }

        CustomUserPrincipal principal = CustomUserPrincipal.from(
                account, effectivePermissionService.resolve(account));
        return UsernamePasswordAuthenticationToken.authenticated(
                principal,
                null,
                principal.getAuthorities()
        );
    }

    private static ApiAuthenticationException invalidToken() {
        return new ApiAuthenticationException(
                HttpStatus.UNAUTHORIZED,
                "AUTH_TOKEN_INVALID",
                "Access Token không hợp lệ"
        );
    }
}
