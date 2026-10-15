package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.dto.LoginResponse;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.RefreshToken;
import sparkminds.librarymanagement.auth.entity.RevokedAccessToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.repository.RevokedAccessTokenRepository;
import sparkminds.librarymanagement.auth.security.jwt.ExpiredJwtTokenException;
import sparkminds.librarymanagement.auth.security.jwt.InvalidJwtTokenException;
import sparkminds.librarymanagement.auth.security.jwt.IssuedJwtToken;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;
import sparkminds.librarymanagement.auth.security.jwt.VerifiedJwtToken;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class AuthSessionService {

    private final JwtTokenService jwtTokenService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final RevokedAccessTokenRepository revokedAccessTokenRepository;
    private final AccountRepository accountRepository;
    private final Clock clock;

    @Transactional
    public RefreshResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw refreshError("AUTH_REFRESH_TOKEN_MISSING", "Refresh Token cookie không tồn tại");
        }

        VerifiedJwtToken claims;
        try {
            claims = jwtTokenService.verify(rawRefreshToken, JwtTokenType.REFRESH);
        } catch (ExpiredJwtTokenException exception) {
            throw refreshError("AUTH_REFRESH_TOKEN_EXPIRED", "Refresh Token đã hết hạn");
        } catch (InvalidJwtTokenException exception) {
            throw refreshError("AUTH_REFRESH_TOKEN_INVALID", "Refresh Token không hợp lệ");
        }

        // Khóa tài khoản trước refresh row để disable và refresh cùng thứ tự khóa, tránh phát hành phiên mới sau khi thu hồi.
        Account account = accountRepository.findByIdForUpdate(claims.accountId())
                .orElseThrow(() -> refreshError("AUTH_REFRESH_TOKEN_INVALID", "Refresh Token không hợp lệ"));
        if (!account.isEnabled()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "AUTH_ACCOUNT_DISABLED", "Tài khoản hiện không thể đăng nhập");
        }
        if (claims.sessionVersion() != account.getSessionVersion()) {
            if ("ROLE_CHANGED".equals(account.getLastSessionChangeReason())) {
                throw refreshError("AUTH_ROLE_CHANGED", "Vai trò đã thay đổi, vui lòng đăng nhập lại");
            }
            throw refreshError("AUTH_REFRESH_TOKEN_REVOKED", "Refresh Token đã bị thu hồi");
        }

        RefreshToken current = refreshTokenRepository.findByJtiForUpdate(claims.jti().toString())
                .orElseThrow(() -> refreshError("AUTH_REFRESH_TOKEN_INVALID", "Refresh Token không hợp lệ"));
        if (current.getRevokedAt() != null) {
            throw refreshError("AUTH_REFRESH_TOKEN_REVOKED", "Refresh Token đã bị thu hồi");
        }

        LocalDateTime now = nowUtc();
        if (!current.getExpiresAt().isAfter(now)) {
            throw refreshError("AUTH_REFRESH_TOKEN_EXPIRED", "Refresh Token đã hết hạn");
        }

        if (!account.getId().equals(current.getAccount().getId())) {
            throw refreshError("AUTH_REFRESH_TOKEN_INVALID", "Refresh Token không hợp lệ");
        }
        if (!account.isEnabled()) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "AUTH_ACCOUNT_DISABLED",
                    "Tài khoản hiện không thể đăng nhập"
            );
        }

        if (!account.isSystemAccount() && account.getEmail() != null && !account.isEmailVerified()) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "EMAIL_NOT_VERIFIED",
                    "Email chưa được xác thực. Vui lòng xác thực email trước khi đăng nhập."
            );
        }

        current.setRevokedAt(now);
        IssuedJwtToken accessToken = jwtTokenService.issue(
                account.getId(), account.getSessionVersion(), JwtTokenType.ACCESS);
        IssuedJwtToken newRefreshToken = jwtTokenService.issue(
                account.getId(), account.getSessionVersion(), JwtTokenType.REFRESH);
        refreshTokenRepository.save(createRefreshMetadata(account, newRefreshToken));

        return new RefreshResult(
                new LoginResponse(accessToken.value(), "Bearer", jwtTokenService.expiresInSeconds(JwtTokenType.ACCESS)),
                newRefreshToken.value()
        );
    }

    @Transactional
    public void logout(String authorizationHeader, String rawRefreshToken) {
        VerifiedJwtToken accessClaims = verifyOptional(authorizationHeader, JwtTokenType.ACCESS);
        RefreshToken activeRefresh = findActiveRefreshForLogout(rawRefreshToken);

        Account accessAccount = null;
        if (accessClaims != null) {
            accessAccount = accountRepository.findById(accessClaims.accountId()).orElse(null);
            if (accessAccount == null) {
                accessClaims = null;
            }
        }

        if (accessClaims != null && activeRefresh != null
                && !accessClaims.accountId().equals(activeRefresh.getAccount().getId())) {
            throw new BusinessException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTH_TOKEN_INVALID",
                    "Access Token và Refresh Token không thuộc cùng một tài khoản"
            );
        }

        LocalDateTime now = nowUtc();
        if (activeRefresh != null) {
            activeRefresh.setRevokedAt(now);
        }
        if (accessClaims != null && !revokedAccessTokenRepository.existsByJti(accessClaims.jti().toString())) {
            RevokedAccessToken revoked = new RevokedAccessToken();
            revoked.setJti(accessClaims.jti().toString());
            revoked.setAccount(accessAccount);
            revoked.setExpiresAt(LocalDateTime.ofInstant(accessClaims.expiresAt(), ZoneOffset.UTC));
            revoked.setRevokedAt(now);
            revokedAccessTokenRepository.save(revoked);
        }
    }

    private RefreshToken findActiveRefreshForLogout(String rawRefreshToken) {
        VerifiedJwtToken claims = verifyOptional(rawRefreshToken, JwtTokenType.REFRESH);
        if (claims == null) {
            return null;
        }
        RefreshToken record = refreshTokenRepository.findByJtiForUpdate(claims.jti().toString()).orElse(null);
        if (record == null || record.getRevokedAt() != null || !record.getExpiresAt().isAfter(nowUtc())
                || !record.getAccount().getId().equals(claims.accountId())) {
            return null;
        }
        return record;
    }

    private VerifiedJwtToken verifyOptional(String tokenOrHeader, JwtTokenType expectedType) {
        if (tokenOrHeader == null || tokenOrHeader.isBlank()) {
            return null;
        }
        String rawToken = tokenOrHeader;
        if (expectedType == JwtTokenType.ACCESS) {
            if (!tokenOrHeader.startsWith("Bearer ") || tokenOrHeader.length() <= "Bearer ".length()) {
                return null;
            }
            rawToken = tokenOrHeader.substring("Bearer ".length()).trim();
        }
        try {
            return jwtTokenService.verify(rawToken, expectedType);
        } catch (ExpiredJwtTokenException | InvalidJwtTokenException exception) {
            return null;
        }
    }

    private RefreshToken createRefreshMetadata(Account account, IssuedJwtToken token) {
        RefreshToken metadata = new RefreshToken();
        metadata.setAccount(account);
        metadata.setJti(token.jti());
        metadata.setExpiresAt(LocalDateTime.ofInstant(token.expiresAt(), ZoneOffset.UTC));
        return metadata;
    }

    private LocalDateTime nowUtc() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private static BusinessException refreshError(String code, String message) {
        return new BusinessException(HttpStatus.UNAUTHORIZED, code, message);
    }
}
