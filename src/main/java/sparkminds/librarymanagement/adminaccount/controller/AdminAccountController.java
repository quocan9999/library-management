package sparkminds.librarymanagement.adminaccount.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountCreateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountPageResponse;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountResponse;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountRoleUpdateRequest;
import sparkminds.librarymanagement.adminaccount.dto.AdminAccountStatusUpdateRequest;
import sparkminds.librarymanagement.adminaccount.service.AdminAccountService;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/admin/accounts")
@RequiredArgsConstructor
public class AdminAccountController {
    private final AdminAccountService service;

    @GetMapping
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<ApiResponse<AdminAccountPageResponse>> search(
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String roleCode,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Boolean emailVerified,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort
    ) {
        return ResponseEntity.ok(ApiResponse.success(200, "ADMIN_ACCOUNT_SEARCH_SUCCESS", "Đã tìm thấy tài khoản quản trị",
                service.search(actor, username, email, roleCode, enabled, emailVerified, page, size, sort)));
    }

    @GetMapping("/{accountId}")
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<ApiResponse<AdminAccountResponse>> get(
            @AuthenticationPrincipal CustomUserPrincipal actor, @PathVariable Integer accountId) {
        return ResponseEntity.ok(ApiResponse.success(200, "ADMIN_ACCOUNT_DETAIL_SUCCESS", "Lấy thông tin tài khoản thành công",
                service.get(actor, accountId)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('role:update')")
    public ResponseEntity<ApiResponse<AdminAccountResponse>> create(
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @Valid @RequestBody AdminAccountCreateRequest request
    ) {
        AdminAccountResponse created = service.create(actor, request);
        return ResponseEntity.created(URI.create("/api/v1/admin/accounts/" + created.id()))
                .body(ApiResponse.success(HttpStatus.CREATED.value(), "ADMIN_ACCOUNT_CREATED", "Đã tạo tài khoản quản trị. Vui lòng xác thực email.", created));
    }

    @PatchMapping("/{accountId}/role")
    @PreAuthorize("hasAuthority('role:update')")
    public ResponseEntity<ApiResponse<AdminAccountResponse>> updateRole(
            @AuthenticationPrincipal CustomUserPrincipal actor, @PathVariable Integer accountId,
            @Valid @RequestBody AdminAccountRoleUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(200, "ADMIN_ACCOUNT_ROLE_UPDATED", "Đã cập nhật nhóm quyền tài khoản",
                service.updateRole(actor, accountId, request)));
    }

    @PatchMapping("/{accountId}/status")
    @PreAuthorize("hasAuthority('role:update')")
    public ResponseEntity<ApiResponse<AdminAccountResponse>> updateStatus(
            @AuthenticationPrincipal CustomUserPrincipal actor, @PathVariable Integer accountId,
            @Valid @RequestBody AdminAccountStatusUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(200, "ADMIN_ACCOUNT_STATUS_UPDATED", "Đã cập nhật trạng thái tài khoản",
                service.updateStatus(actor, accountId, request)));
    }
}
