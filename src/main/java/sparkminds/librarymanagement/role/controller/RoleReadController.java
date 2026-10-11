package sparkminds.librarymanagement.role.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.role.dto.PermissionCatalogResponse;
import sparkminds.librarymanagement.role.dto.RolePermissionsResponse;
import sparkminds.librarymanagement.role.dto.RoleSummaryResponse;
import sparkminds.librarymanagement.role.service.RoleReadService;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class RoleReadController {

    private final RoleReadService roleReadService;

    public RoleReadController(RoleReadService roleReadService) {
        this.roleReadService = roleReadService;
    }

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
}
