package sparkminds.librarymanagement.auth.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.dto.LoginRequest;
import sparkminds.librarymanagement.auth.dto.LoginResponse;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.dto.RegisterResponse;
import sparkminds.librarymanagement.auth.service.AuthService;
import sparkminds.librarymanagement.auth.service.LoginResult;
import sparkminds.librarymanagement.auth.service.RegistrationService;
import sparkminds.librarymanagement.auth.service.RefreshCookieFactory;
import sparkminds.librarymanagement.common.api.ApiResponse;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RegistrationService registrationService;
    private final RefreshCookieFactory refreshCookieFactory;

    public AuthController(
            AuthService authService,
            RegistrationService registrationService,
            RefreshCookieFactory refreshCookieFactory
    ) {
        this.authService = authService;
        this.registrationService = registrationService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = registrationService.register(request);
        ApiResponse<RegisterResponse> body = ApiResponse.success(
                201,
                "REGISTER_SUCCESS",
                "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
                response
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
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
