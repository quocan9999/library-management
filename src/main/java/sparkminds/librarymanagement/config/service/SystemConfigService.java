package sparkminds.librarymanagement.config.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
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
import sparkminds.librarymanagement.config.repository.SystemMaintenanceDetailRepository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service quản lý cấu hình hệ thống và chế độ bảo trì.
 * Sử dụng transaction chặt chẽ và ghi log qua Log4j2.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SystemConfigService {

    private static final Byte DEFAULT_CONFIG_ID = (byte) 1;
    private static final String DEFAULT_MAINTENANCE_MESSAGE = "Hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.";

    private final SystemConfigRepository systemConfigRepository;
    private final SystemConfigHistoryRepository systemConfigHistoryRepository;
    private final AccountRepository accountRepository;
    private final SystemMaintenanceDetailRepository systemMaintenanceDetailRepository;

    /** Cờ bộ nhớ đệm phục vụ kiểm tra tức thời tại AOP mà không gây tải cho Database. */
    private volatile boolean cachedMaintenanceMode = false;

    @PostConstruct
    public void initCache() {
        try {
            systemConfigRepository.findById(DEFAULT_CONFIG_ID).ifPresent(config -> {
                this.cachedMaintenanceMode = config.isMaintenanceMode();
                log.info("SystemConfig initialized: maintenanceMode={}", cachedMaintenanceMode);
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
     * Lấy thông điệp bảo trì hệ thống.
     */
    public String getMaintenanceMessage() {
        return DEFAULT_MAINTENANCE_MESSAGE;
    }

    /**
     * Kiểm tra vai trò có thuộc danh sách miễn trừ (bypass) hay không.
     * Chỉ vai trò ADMIN được phép quản trị và truy cập khi bảo trì.
     */
    public boolean isBypassedRole(String roleCode) {
        if (roleCode == null) return false;
        return "ROLE_ADMIN".equalsIgnoreCase(roleCode) || "ADMIN".equalsIgnoreCase(roleCode);
    }

    /**
     * Lấy cấu hình hệ thống hiện tại kèm lịch sử mới nhất.
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

        SystemMaintenanceDetail detail = config.getMaintenanceDetail();
        if (detail == null) {
            detail = new SystemMaintenanceDetail();
            detail.setSystemConfig(config);
            config.setMaintenanceDetail(detail);
        }

        if (newMode) {
            if (request.expectedEndTime() != null) {
                if (!request.expectedEndTime().isAfter(LocalDateTime.now())) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_EXPECTED_END_TIME", "Thời gian dự kiến hoàn thành phải ở tương lai");
                }
                detail.setExpectedEndTime(request.expectedEndTime());
            } else {
                detail.setExpectedEndTime(null);
            }
        } else {
            // Khi tắt chế độ bảo trì, thời gian dự kiến kết thúc được xóa (reset về null)
            detail.setExpectedEndTime(null);
        }

        systemConfigRepository.save(config);
        systemMaintenanceDetailRepository.save(detail);

        // Ghi lại lịch sử @ManyToOne SystemConfigHistory
        Account actor = actorAccountId != null ? accountRepository.findById(actorAccountId).orElse(null) : null;
        SystemConfigHistory history = new SystemConfigHistory();
        history.setSystemConfig(config);
        history.setAccount(actor);
        history.setAction(newMode ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED");
        history.setReason(request.reason() != null && !request.reason().isBlank() ? request.reason() : "Không ghi rõ lý do");
        history.setDetail(String.format("Chuyển trạng thái từ %s sang %s",
                previousMode ? "BẬT" : "TẮT",
                newMode ? "BẬT" : "TẮT"));

        systemConfigHistoryRepository.save(history);

        // Đồng bộ cache bộ nhớ đệm
        this.cachedMaintenanceMode = newMode;

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
        return new SystemConfigResponse(
                (int) config.getId(),
                config.isMaintenanceMode(),
                detail != null ? detail.getExpectedEndTime() : null,
                config.getUpdatedAt(),
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
