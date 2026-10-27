package sparkminds.librarymanagement.config.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import sparkminds.librarymanagement.auth.entity.Role;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Thực thể cấu hình chung của hệ thống.
 * Áp dụng đầy đủ các quan hệ Hibernate:
 * - @OneToOne: SystemMaintenanceDetail (thông tin chi tiết bảo trì)
 * - @OneToMany: SystemConfigHistory (danh sách lịch sử cập nhật cấu hình)
 * - @ManyToMany: Role (danh sách các vai trò được miễn trừ chặn khi bảo trì)
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "system_configs")
public class SystemConfig {

    @Id
    private Byte id;

    @Column(name = "maintenance_mode", nullable = false)
    private boolean maintenanceMode = false;

    @OneToOne(mappedBy = "systemConfig", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private SystemMaintenanceDetail maintenanceDetail;

    @OneToMany(mappedBy = "systemConfig", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<SystemConfigHistory> histories = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "system_config_bypass_roles",
            joinColumns = @JoinColumn(name = "system_config_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> bypassRoles = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
