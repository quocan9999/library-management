package sparkminds.librarymanagement.auth.controller;

import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.dto.LoginRequest;
import sparkminds.librarymanagement.auth.dto.LoginVerificationRequest;
import sparkminds.librarymanagement.auth.dto.LoginResponse;
import sparkminds.librarymanagement.auth.dto.AuthMeResponse;
import sparkminds.librarymanagement.auth.dto.ForgotPasswordRequest;
import sparkminds.librarymanagement.auth.dto.ResetPasswordRequest;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.dto.RegisterResponse;
import sparkminds.librarymanagement.auth.dto.ResendVerificationRequest;
import sparkminds.librarymanagement.auth.dto.VerifyEmailRequest;
import sparkminds.librarymanagement.auth.service.AuthService;
import sparkminds.librarymanagement.auth.service.AuthMeService;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.service.EmailVerificationService;
import sparkminds.librarymanagement.auth.service.LoginResult;
import sparkminds.librarymanagement.auth.service.RegistrationService;
import sparkminds.librarymanagement.auth.service.RefreshCookieFactory;
import sparkminds.librarymanagement.auth.service.ResendVerificationService;
import sparkminds.librarymanagement.auth.service.ForgotPasswordService;
import sparkminds.librarymanagement.auth.service.PasswordResetService;
import sparkminds.librarymanagement.common.api.ApiResponse;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthMeService authMeService;
    private final RegistrationService registrationService;
    private final EmailVerificationService emailVerificationService;
    private final ResendVerificationService resendVerificationService;
    private final ForgotPasswordService forgotPasswordService;
    private final PasswordResetService passwordResetService;
    private final RefreshCookieFactory refreshCookieFactory;

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

    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        emailVerificationService.verify(request.token());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "EMAIL_VERIFIED",
                "Xác thực email thành công. Bạn có thể đăng nhập.",
                null
        ));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<Void>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request
    ) {
        resendVerificationService.resend(request.email());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "VERIFICATION_EMAIL_REQUESTED",
                "Nếu email chưa được xác thực, hướng dẫn xác thực sẽ được gửi đến hộp thư.",
                null
        ));
    }

    @PostMapping("/resend-login-verification")
    public ResponseEntity<ApiResponse<Void>> resendLoginVerification(
            @Valid @RequestBody LoginVerificationRequest request
    ) {
        resendVerificationService.resendForLogin(request.identifier());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(), "VERIFICATION_EMAIL_REQUESTED",
                "Nếu email chưa được xác thực, hướng dẫn xác thực sẽ được gửi đến hộp thư.", null
        ));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        forgotPasswordService.requestReset(request.email());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "FORGOT_PASSWORD_REQUESTED",
                "Nếu email đủ điều kiện, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư.",
                null
        ));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.reset(request);
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "PASSWORD_RESET_SUCCESS",
                "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.",
                null
        ));
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

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<AuthMeResponse>> currentAccount(
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "AUTH_ME_SUCCESS",
                "Lấy thông tin tài khoản thành công",
                authMeService.getCurrentAccount(principal)
        ));
    }
}
