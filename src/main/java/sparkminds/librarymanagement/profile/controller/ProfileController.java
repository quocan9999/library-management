package sparkminds.librarymanagement.profile.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.profile.dto.ChangePasswordRequest;
import sparkminds.librarymanagement.profile.service.PasswordChangeService;

@RestController
@RequestMapping("/api/v1/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final PasswordChangeService passwordChangeService;

    @PostMapping("/change-password")
    @PreAuthorize("hasAuthority('account:change-password') and principal.roleCode == 'ROLE_USER'")
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
}
