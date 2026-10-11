package sparkminds.librarymanagement.auth.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.dto.LoginResponse;
import sparkminds.librarymanagement.auth.service.AuthSessionService;
import sparkminds.librarymanagement.auth.service.RefreshCookieFactory;
import sparkminds.librarymanagement.auth.service.RefreshResult;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.common.api.BusinessException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthSessionController {

    private final AuthSessionService authSessionService;
    private final RefreshCookieFactory refreshCookieFactory;

    public AuthSessionController(AuthSessionService authSessionService, RefreshCookieFactory refreshCookieFactory) {
        this.authSessionService = authSessionService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(
            @CookieValue(name = RefreshCookieFactory.NAME, required = false) String refreshToken
    ) {
        RefreshResult result = authSessionService.refresh(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(result.refreshToken()).toString())
                .body(ApiResponse.success(
                        200,
                        "AUTH_TOKEN_REFRESHED",
                        "Làm mới token thành công",
                        result.response()
                ));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @CookieValue(name = RefreshCookieFactory.NAME, required = false) String refreshToken
    ) {
        try {
            authSessionService.logout(authorizationHeader, refreshToken);
        } catch (BusinessException exception) {
            if (!"AUTH_TOKEN_INVALID".equals(exception.getCode())) {
                throw exception;
            }
            return ResponseEntity.status(exception.getStatus())
                    .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.clear().toString())
                    .body(ApiResponse.error(
                            exception.getStatus().value(),
                            exception.getCode(),
                            exception.getMessage(),
                            null
                    ));
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.clear().toString())
                .body(ApiResponse.success(200, "AUTH_LOGOUT_SUCCESS", "Đăng xuất thành công", null));
    }
}
