package sparkminds.librarymanagement.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.config.dto.SystemConfigResponse;
import sparkminds.librarymanagement.config.dto.UpdateMaintenanceRequest;
import sparkminds.librarymanagement.config.entity.SystemConfig;
import sparkminds.librarymanagement.config.entity.SystemConfigHistory;
import sparkminds.librarymanagement.config.entity.SystemMaintenanceDetail;
import sparkminds.librarymanagement.config.repository.SystemConfigHistoryRepository;
import sparkminds.librarymanagement.config.repository.SystemConfigRepository;
import sparkminds.librarymanagement.config.service.SystemConfigService;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SystemConfigServiceTest {

    @Mock
    private SystemConfigRepository systemConfigRepository;

    @Mock
    private SystemConfigHistoryRepository systemConfigHistoryRepository;

    @Mock
    private AccountRepository accountRepository;

    @InjectMocks
    private SystemConfigService service;

    private SystemConfig mockConfig;

    @BeforeEach
    void setUp() {
        mockConfig = new SystemConfig();
        mockConfig.setId((byte) 1);
        mockConfig.setMaintenanceMode(false);

        SystemMaintenanceDetail detail = new SystemMaintenanceDetail();
        detail.setSystemConfig(mockConfig);
        detail.setBannerMessage("Hệ thống bảo trì định kỳ");
        detail.setContactEmail("admin@example.com");
        mockConfig.setMaintenanceDetail(detail);

        Role adminRole = new Role();
        adminRole.setId((short) 1);
        adminRole.setCode("ROLE_ADMIN");
        mockConfig.setBypassRoles(Set.of(adminRole));
    }

    @Test
    @DisplayName("getSystemConfig trả về thông tin cấu hình và lịch sử gần nhất")
    void getSystemConfig_success() {
        when(systemConfigRepository.findByIdWithDetails((byte) 1)).thenReturn(Optional.of(mockConfig));

        SystemConfigHistory history = new SystemConfigHistory();
        history.setId(10L);
        history.setAction("INIT");
        history.setReason("Khởi tạo");
        history.setCreatedAt(LocalDateTime.now());

        when(systemConfigHistoryRepository.findBySystemConfigIdOrderByCreatedAtDesc(eq((byte) 1), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(history)));

        SystemConfigResponse response = service.getSystemConfig();

        assertThat(response).isNotNull();
        assertThat(response.maintenanceMode()).isFalse();
        assertThat(response.bannerMessage()).isEqualTo("Hệ thống bảo trì định kỳ");
        assertThat(response.bypassRoles()).contains("ROLE_ADMIN");
        assertThat(response.recentHistories()).hasSize(1);
    }

    @Test
    @DisplayName("getSystemConfig ném BusinessException khi không tìm thấy config id=1")
    void getSystemConfig_notFound_throwsException() {
        when(systemConfigRepository.findByIdWithDetails((byte) 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSystemConfig())
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("updateMaintenanceMode bật bảo trì thành công, lưu lịch sử và cập nhật cache")
    void updateMaintenanceMode_enableMaintenance() {
        when(systemConfigRepository.findByIdWithDetails((byte) 1)).thenReturn(Optional.of(mockConfig));

        Account adminAccount = new Account();
        adminAccount.setId(42);
        adminAccount.setUsername("superadmin");
        when(accountRepository.findById(42)).thenReturn(Optional.of(adminAccount));

        when(systemConfigHistoryRepository.findBySystemConfigIdOrderByCreatedAtDesc(eq((byte) 1), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        UpdateMaintenanceRequest request = new UpdateMaintenanceRequest(
                true,
                "Nâng cấp database",
                "Hệ thống đang bảo trì",
                "support@example.com",
                LocalDateTime.now().plusHours(2)
        );

        SystemConfigResponse response = service.updateMaintenanceMode(42, request);

        assertThat(response.maintenanceMode()).isTrue();
        assertThat(service.isMaintenanceActive()).isTrue();
        verify(systemConfigRepository).save(mockConfig);
        verify(systemConfigHistoryRepository).save(any(SystemConfigHistory.class));
    }

    @Test
    @DisplayName("isBypassedRole kiểm tra role admin luôn được phép bypass")
    void isBypassedRole_adminAlwaysAllowed() {
        assertThat(service.isBypassedRole("ROLE_ADMIN")).isTrue();
        assertThat(service.isBypassedRole("ADMIN")).isTrue();
        assertThat(service.isBypassedRole("ROLE_USER")).isFalse();
        assertThat(service.isBypassedRole(null)).isFalse();
    }
}
