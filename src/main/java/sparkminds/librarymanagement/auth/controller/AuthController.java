package sparkminds.librarymanagement.auth.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.dto.LoginRequest;
import sparkminds.librarymanagement.auth.dto.LoginResponse;
import sparkminds.librarymanagement.auth.service.AuthService;
import sparkminds.librarymanagement.auth.service.LoginResult;
import sparkminds.librarymanagement.auth.service.RefreshCookieFactory;
import sparkminds.librarymanagement.common.api.ApiResponse;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshCookieFactory refreshCookieFactory;

    public AuthController(AuthService authService, RefreshCookieFactory refreshCookieFactory) {
        this.authService = authService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        LoginResult result = authService.login(request);
        ApiResponse<LoginResponse> body = ApiResponse.success(
                200,
                "AUTH_LOGIN_SUCCESS",
                "Đăng nhập thành công",
                result.response()
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(result.refreshToken()).toString())
                .body(body);
    }
}
