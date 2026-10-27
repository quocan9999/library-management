package sparkminds.librarymanagement.config.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Thực thể cấu hình chung của hệ thống.
 * Quan hệ 1-1 (@OneToOne) với SystemMaintenanceDetail.
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

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
