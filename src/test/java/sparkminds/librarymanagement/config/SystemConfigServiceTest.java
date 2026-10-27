package sparkminds.librarymanagement.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.config.dto.SystemConfigResponse;
import sparkminds.librarymanagement.config.dto.UpdateMaintenanceRequest;
import sparkminds.librarymanagement.config.entity.SystemConfig;
import sparkminds.librarymanagement.config.entity.SystemConfigHistory;
import sparkminds.librarymanagement.config.entity.SystemMaintenanceDetail;
import sparkminds.librarymanagement.config.repository.SystemConfigHistoryRepository;
import sparkminds.librarymanagement.config.repository.SystemConfigRepository;
import sparkminds.librarymanagement.config.repository.SystemMaintenanceDetailRepository;
import sparkminds.librarymanagement.config.service.SystemConfigService;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

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

    @Mock
    private SystemMaintenanceDetailRepository systemMaintenanceDetailRepository;

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
        mockConfig.setMaintenanceDetail(detail);
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
                LocalDateTime.now().plusHours(2)
        );

        SystemConfigResponse response = service.updateMaintenanceMode(42, request);

        assertThat(response.maintenanceMode()).isTrue();
        assertThat(response.expectedEndTime()).isNotNull();
        assertThat(service.isMaintenanceActive()).isTrue();
        verify(systemConfigRepository).save(mockConfig);
        verify(systemMaintenanceDetailRepository).save(any(SystemMaintenanceDetail.class));
        verify(systemConfigHistoryRepository).save(any(SystemConfigHistory.class));
    }

    @Test
    @DisplayName("updateMaintenanceMode tắt bảo trì sẽ xóa expectedEndTime về null")
    void updateMaintenanceMode_disableMaintenance_clearsExpectedEndTime() {
        mockConfig.setMaintenanceMode(true);
        mockConfig.getMaintenanceDetail().setExpectedEndTime(LocalDateTime.now().plusHours(3));
        when(systemConfigRepository.findByIdWithDetails((byte) 1)).thenReturn(Optional.of(mockConfig));

        when(systemConfigHistoryRepository.findBySystemConfigIdOrderByCreatedAtDesc(eq((byte) 1), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        UpdateMaintenanceRequest request = new UpdateMaintenanceRequest(
                false,
                "Hoàn tất bảo trì",
                null
        );

        SystemConfigResponse response = service.updateMaintenanceMode(null, request);

        assertThat(response.maintenanceMode()).isFalse();
        assertThat(response.expectedEndTime()).isNull();
        assertThat(mockConfig.getMaintenanceDetail().getExpectedEndTime()).isNull();
        assertThat(service.isMaintenanceActive()).isFalse();
        verify(systemConfigRepository).save(mockConfig);
        verify(systemMaintenanceDetailRepository).save(any(SystemMaintenanceDetail.class));
    }

    @Test
    @DisplayName("updateMaintenanceMode bật bảo trì với expectedEndTime ở quá khứ sẽ ném BusinessException")
    void updateMaintenanceMode_enableMaintenance_pastExpectedEndTime_throwsException() {
        when(systemConfigRepository.findByIdWithDetails((byte) 1)).thenReturn(Optional.of(mockConfig));

        UpdateMaintenanceRequest request = new UpdateMaintenanceRequest(
                true,
                "Bảo trì",
                LocalDateTime.now().minusMinutes(5)
        );

        assertThatThrownBy(() -> service.updateMaintenanceMode(null, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Thời gian dự kiến hoàn thành phải ở tương lai");
    }

    @Test
    @DisplayName("Jackson deserializes ISO datetime string accurately into LocalDateTime")
    void testJacksonDeserialize() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        String json = "{\"maintenanceMode\":true,\"reason\":\"test\",\"expectedEndTime\":\"2026-10-29T10:25:00.000Z\"}";
        UpdateMaintenanceRequest req = mapper.readValue(json, UpdateMaintenanceRequest.class);
        assertThat(req.expectedEndTime()).isEqualTo(LocalDateTime.of(2026, 10, 29, 10, 25));
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
