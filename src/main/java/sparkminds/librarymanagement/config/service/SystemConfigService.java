package sparkminds.librarymanagement.config.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.config.dto.SystemConfigHistoryResponse;
import sparkminds.librarymanagement.config.dto.SystemConfigResponse;
import sparkminds.librarymanagement.config.dto.UpdateMaintenanceRequest;
import sparkminds.librarymanagement.config.entity.SystemConfig;
import sparkminds.librarymanagement.config.entity.SystemConfigHistory;
import sparkminds.librarymanagement.config.entity.SystemMaintenanceDetail;
import sparkminds.librarymanagement.config.repository.SystemConfigHistoryRepository;
import sparkminds.librarymanagement.config.repository.SystemConfigRepository;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service quản lý cấu hình hệ thống và chế độ bảo trì.
 * Sử dụng transaction chặt chẽ và ghi log qua Log4j2.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SystemConfigService {

    private static final Byte DEFAULT_CONFIG_ID = (byte) 1;

    private final SystemConfigRepository systemConfigRepository;
    private final SystemConfigHistoryRepository systemConfigHistoryRepository;
    private final AccountRepository accountRepository;

    /** Cờ bộ nhớ đệm phục vụ kiểm tra tức thời tại AOP mà không gây tải cho Database. */
    private volatile boolean cachedMaintenanceMode = false;
    private final Set<String> cachedBypassRoles = ConcurrentHashMap.newKeySet();

    @PostConstruct
    public void initCache() {
        try {
            systemConfigRepository.findByIdWithDetails(DEFAULT_CONFIG_ID).ifPresent(config -> {
                this.cachedMaintenanceMode = config.isMaintenanceMode();
                this.cachedBypassRoles.clear();
                if (config.getBypassRoles() != null) {
                    this.cachedBypassRoles.addAll(
                            config.getBypassRoles().stream().map(Role::getCode).collect(Collectors.toSet())
                    );
                }
                log.info("SystemConfig initialized: maintenanceMode={}, bypassRoles={}",
                        cachedMaintenanceMode, cachedBypassRoles);
            });
        } catch (Exception ex) {
            log.error("Failed to load initial system config into memory cache", ex);
        }
    }

    /**
     * Kiểm tra chế độ bảo trì hiện tại từ bộ nhớ đệm.
     */
    public boolean isMaintenanceActive() {
        return cachedMaintenanceMode;
    }

    /**
     * Kiểm tra vai trò có thuộc danh sách miễn trừ (bypass) hay không.
     */
    public boolean isBypassedRole(String roleCode) {
        if (roleCode == null) return false;
        // ROLE_ADMIN luôn luôn được bypass
        if ("ROLE_ADMIN".equalsIgnoreCase(roleCode) || "ADMIN".equalsIgnoreCase(roleCode)) {
            return true;
        }
        return cachedBypassRoles.contains(roleCode);
    }

    /**
     * Lấy cấu hình hệ thống hiện tại kèm chi tiết và lịch sử mới nhất.
     */
    @Transactional(readOnly = true)
    public SystemConfigResponse getSystemConfig() {
        SystemConfig config = systemConfigRepository.findByIdWithDetails(DEFAULT_CONFIG_ID)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SYSTEM_CONFIG_NOT_FOUND", "Không tìm thấy cấu hình hệ thống"));

        List<SystemConfigHistoryResponse> recentHistories = systemConfigHistoryRepository
                .findBySystemConfigIdOrderByCreatedAtDesc(DEFAULT_CONFIG_ID, PageRequest.of(0, 10))
                .getContent()
                .stream()
                .map(this::toHistoryResponse)
                .toList();

        return toConfigResponse(config, recentHistories);
    }

    /**
     * Cập nhật trạng thái bảo trì và thông tin chi tiết.
     * Sử dụng transaction để rollback toàn bộ nếu có lỗi xảy ra.
     */
    @Transactional(rollbackFor = Exception.class)
    public SystemConfigResponse updateMaintenanceMode(Integer actorAccountId, UpdateMaintenanceRequest request) {
        log.info("Updating maintenance mode: actorId={}, maintenanceMode={}, reason={}",
                actorAccountId, request.maintenanceMode(), request.reason());

        SystemConfig config = systemConfigRepository.findByIdWithDetails(DEFAULT_CONFIG_ID)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SYSTEM_CONFIG_NOT_FOUND", "Không tìm thấy cấu hình hệ thống"));

        boolean previousMode = config.isMaintenanceMode();
        boolean newMode = Boolean.TRUE.equals(request.maintenanceMode());
        config.setMaintenanceMode(newMode);

        // Cập nhật thông tin @OneToOne SystemMaintenanceDetail
        SystemMaintenanceDetail detail = config.getMaintenanceDetail();
        if (detail == null) {
            detail = new SystemMaintenanceDetail();
            detail.setSystemConfig(config);
            config.setMaintenanceDetail(detail);
        }

        if (request.bannerMessage() != null) {
            detail.setBannerMessage(request.bannerMessage());
        }
        if (request.contactEmail() != null) {
            detail.setContactEmail(request.contactEmail());
        }
        if (request.expectedEndTime() != null) {
            detail.setExpectedEndTime(request.expectedEndTime());
        }

        systemConfigRepository.save(config);

        // Ghi lại lịch sử @ManyToOne SystemConfigHistory
        Account actor = actorAccountId != null ? accountRepository.findById(actorAccountId).orElse(null) : null;
        SystemConfigHistory history = new SystemConfigHistory();
        history.setSystemConfig(config);
        history.setAccount(actor);
        history.setAction(newMode ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED");
        history.setReason(request.reason() != null && !request.reason().isBlank() ? request.reason() : "Không ghi rõ lý do");
        history.setDetail(String.format("Chuyển trạng thái từ %s sang %s. Thông báo: %s",
                previousMode ? "BẬT" : "TẮT",
                newMode ? "BẬT" : "TẮT",
                detail.getBannerMessage() != null ? detail.getBannerMessage() : "Mặc định"));

        systemConfigHistoryRepository.save(history);

        // Đồng bộ cache bộ nhớ đệm
        this.cachedMaintenanceMode = newMode;
        if (config.getBypassRoles() != null) {
            this.cachedBypassRoles.clear();
            this.cachedBypassRoles.addAll(
                    config.getBypassRoles().stream().map(Role::getCode).collect(Collectors.toSet())
            );
        }

        log.info("Maintenance mode updated successfully: maintenanceMode={}, updatedBy={}",
                newMode, actor != null ? actor.getUsername() : "SYSTEM");

        List<SystemConfigHistoryResponse> recentHistories = systemConfigHistoryRepository
                .findBySystemConfigIdOrderByCreatedAtDesc(DEFAULT_CONFIG_ID, PageRequest.of(0, 10))
                .getContent()
                .stream()
                .map(this::toHistoryResponse)
                .toList();

        return toConfigResponse(config, recentHistories);
    }

    private SystemConfigResponse toConfigResponse(SystemConfig config, List<SystemConfigHistoryResponse> recentHistories) {
        SystemMaintenanceDetail detail = config.getMaintenanceDetail();
        Set<String> bypassRoleCodes = config.getBypassRoles() != null
                ? config.getBypassRoles().stream().map(Role::getCode).collect(Collectors.toSet())
                : Collections.emptySet();

        return new SystemConfigResponse(
                config.getId(),
                config.isMaintenanceMode(),
                detail != null ? detail.getBannerMessage() : null,
                detail != null ? detail.getContactEmail() : null,
                detail != null ? detail.getExpectedEndTime() : null,
                config.getUpdatedAt(),
                bypassRoleCodes,
                recentHistories
        );
    }

    private SystemConfigHistoryResponse toHistoryResponse(SystemConfigHistory history) {
        return new SystemConfigHistoryResponse(
                history.getId(),
                history.getAction(),
                history.getAccount() != null ? (history.getAccount().getUsername() != null ? history.getAccount().getUsername() : history.getAccount().getEmail()) : "Hệ thống",
                history.getReason(),
                history.getDetail(),
                history.getCreatedAt()
        );
    }
}
