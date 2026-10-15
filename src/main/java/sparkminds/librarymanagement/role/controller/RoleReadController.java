package sparkminds.librarymanagement.role.controller;

import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.role.dto.PermissionCatalogResponse;
import sparkminds.librarymanagement.role.dto.RoleCreateRequest;
import sparkminds.librarymanagement.role.dto.RoleDetailResponse;
import sparkminds.librarymanagement.role.dto.RoleMetadataUpdateRequest;
import sparkminds.librarymanagement.role.dto.RolePermissionUpdateRequest;
import sparkminds.librarymanagement.role.dto.RolePermissionsResponse;
import sparkminds.librarymanagement.role.dto.RoleSearchResponse;
import sparkminds.librarymanagement.role.dto.RoleStatusUpdateRequest;
import sparkminds.librarymanagement.role.dto.RoleSummaryResponse;
import sparkminds.librarymanagement.role.service.RoleManagementService;
import sparkminds.librarymanagement.role.service.RolePermissionMutationService;
import sparkminds.librarymanagement.role.service.RoleReadService;

import java.util.List;
import java.net.URI;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class RoleReadController {

    private final RoleReadService roleReadService;
    private final RolePermissionMutationService rolePermissionMutationService;
    private final RoleManagementService roleManagementService;

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<ApiResponse<List<RoleSummaryResponse>>> getRoles(
            @AuthenticationPrincipal CustomUserPrincipal actor
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "ROLE_LIST_SUCCESS",
                "Lấy danh sách vai trò thành công",
                roleReadService.getRoles(actor)
        ));
    }

    @GetMapping("/roles/search")
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<ApiResponse<RoleSearchResponse>> searchRoles(
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "ROLE_SEARCH_SUCCESS",
                "Đã tìm thấy nhóm quyền",
                roleReadService.searchRoles(actor, q, status, page, size, sort, direction)
        ));
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('role:update')")
    public ResponseEntity<ApiResponse<RoleDetailResponse>> createRole(
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @Valid @RequestBody RoleCreateRequest request
    ) {
        RoleDetailResponse created = roleManagementService.createRole(actor, request);
        return ResponseEntity.created(URI.create("/api/v1/roles/" + created.code()))
                .body(ApiResponse.success(
                        HttpStatus.CREATED.value(),
                        "ROLE_CREATED",
                        "Đã tạo nhóm quyền",
                        created
                ));
    }

    @GetMapping("/roles/{roleCode}")
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<ApiResponse<RoleDetailResponse>> getRole(
            @PathVariable String roleCode,
            @AuthenticationPrincipal CustomUserPrincipal actor
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "ROLE_DETAIL_SUCCESS",
                "Lấy thông tin nhóm quyền thành công",
                roleReadService.getRole(actor, roleCode)
        ));
    }

    @PatchMapping("/roles/{roleCode}")
    @PreAuthorize("hasAuthority('role:update')")
    public ResponseEntity<ApiResponse<RoleDetailResponse>> updateRoleMetadata(
            @PathVariable String roleCode,
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @Valid @RequestBody RoleMetadataUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "ROLE_UPDATED",
                "Đã cập nhật nhóm quyền",
                roleManagementService.updateMetadata(actor, roleCode, request)
        ));
    }

    @PatchMapping("/roles/{roleCode}/status")
    @PreAuthorize("hasAuthority('role:update')")
    public ResponseEntity<ApiResponse<RoleDetailResponse>> updateRoleStatus(
            @PathVariable String roleCode,
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @Valid @RequestBody RoleStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "ROLE_STATUS_UPDATED",
                "Đã cập nhật trạng thái nhóm quyền",
                roleManagementService.updateStatus(actor, roleCode, request)
        ));
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<ApiResponse<List<PermissionCatalogResponse>>> getPermissionCatalog(
            @AuthenticationPrincipal CustomUserPrincipal actor
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "PERMISSION_LIST_SUCCESS",
                "Lấy danh mục quyền thành công",
                roleReadService.getPermissionCatalog(actor)
        ));
    }

    @GetMapping("/roles/{roleCode}/permissions")
    @PreAuthorize("hasAuthority('role:read')")
    public ResponseEntity<ApiResponse<RolePermissionsResponse>> getRolePermissions(
            @PathVariable String roleCode,
            @AuthenticationPrincipal CustomUserPrincipal actor
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "ROLE_PERMISSIONS_SUCCESS",
                "Lấy quyền của vai trò thành công",
                roleReadService.getRolePermissions(actor, roleCode)
        ));
    }

    @PatchMapping("/roles/{roleCode}/permissions")
    @PreAuthorize("hasAuthority('role:update')")
    public ResponseEntity<ApiResponse<RolePermissionsResponse>> updateRolePermissions(
            @PathVariable String roleCode,
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @Valid @RequestBody RolePermissionUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "ROLE_PERMISSIONS_UPDATED",
                "Đã cập nhật quyền của vai trò",
                rolePermissionMutationService.updatePermissions(actor, roleCode, request)
        ));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleMalformedRoleRequest(
            HttpMessageNotReadableException exception
    ) {
        return ResponseEntity.badRequest().body(ApiResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                "INVALID_REQUEST_BODY",
                "Nội dung yêu cầu không hợp lệ",
                null
        ));
    }
}
