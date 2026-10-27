package sparkminds.librarymanagement.config.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.config.dto.SystemConfigResponse;
import sparkminds.librarymanagement.config.dto.UpdateMaintenanceRequest;
import sparkminds.librarymanagement.config.service.SystemConfigService;

/**
 * Controller quản lý cấu hình hệ thống và chế độ bảo trì.
 */
@RestController
@RequestMapping("/api/v1/system-configs")
@RequiredArgsConstructor
public class SystemConfigController {

    private final SystemConfigService systemConfigService;

    /**
     * Lấy cấu hình hệ thống hiện tại, bao gồm chi tiết bảo trì và lịch sử thay đổi.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('config:read') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<SystemConfigResponse>> getSystemConfig() {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "SYSTEM_CONFIG_FETCHED",
                "Lấy cấu hình hệ thống thành công",
                systemConfigService.getSystemConfig()
        ));
    }

    /**
     * Bật hoặc tắt chế độ bảo trì, cập nhật thông điệp và ghi nhận nhật ký thao tác.
     */
    @PatchMapping("/maintenance")
    @PreAuthorize("hasAuthority('config:update') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<SystemConfigResponse>> updateMaintenanceMode(
            @AuthenticationPrincipal CustomUserPrincipal actor,
            @Valid @RequestBody UpdateMaintenanceRequest request
    ) {
        Integer actorId = actor != null ? actor.getAccountId() : null;
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "SYSTEM_CONFIG_UPDATED",
                "Cập nhật chế độ bảo trì thành công",
                systemConfigService.updateMaintenanceMode(actorId, request)
        ));
    }
}
