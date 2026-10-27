package sparkminds.librarymanagement.profile.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.member.dto.MemberProfilePatchRequest;
import sparkminds.librarymanagement.profile.dto.ChangePasswordRequest;
import sparkminds.librarymanagement.profile.dto.ChangeEmailRequest;
import sparkminds.librarymanagement.profile.dto.UserProfileResponse;
import sparkminds.librarymanagement.profile.dto.VerifyChangeEmailRequest;
import sparkminds.librarymanagement.profile.service.EmailChangeService;
import sparkminds.librarymanagement.profile.service.PasswordChangeService;
import sparkminds.librarymanagement.profile.service.UserProfileService;

@RestController
@RequestMapping("/api/v1/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final PasswordChangeService passwordChangeService;
    private final EmailChangeService emailChangeService;
    private final UserProfileService userProfileService;

    @GetMapping
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "PROFILE_FETCHED",
                "Lấy thông tin hồ sơ thành công",
                userProfileService.getProfile(principal)
        ));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<UserProfileResponse>> patchProfile(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @Valid @RequestBody MemberProfilePatchRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "PROFILE_UPDATED",
                "Cập nhật hồ sơ thành công",
                userProfileService.patchProfile(principal, request)
        ));
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        passwordChangeService.changePassword(principal, request);
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "PASSWORD_CHANGED",
                "Đổi mật khẩu thành công.",
                null
        ));
    }

    @PostMapping("/change-email/request")
    public ResponseEntity<ApiResponse<Void>> requestEmailChange(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @Valid @RequestBody ChangeEmailRequest request,
            HttpServletRequest servletRequest
    ) {
        emailChangeService.requestChange(principal.getAccountId(), request, servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "EMAIL_CHANGE_CODE_SENT",
                "Mã xác thực đã được gửi đến email mới.",
                null
        ));
    }

    @PostMapping("/change-email/verify")
    public ResponseEntity<ApiResponse<Void>> verifyEmailChange(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @Valid @RequestBody VerifyChangeEmailRequest request,
            HttpServletRequest servletRequest
    ) {
        emailChangeService.verify(principal.getAccountId(), request.code(), servletRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "EMAIL_CHANGED",
                "Email đã được thay đổi thành công.",
                null
        ));
    }
}
