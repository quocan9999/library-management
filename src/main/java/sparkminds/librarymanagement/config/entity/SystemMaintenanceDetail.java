package sparkminds.librarymanagement.config.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Thực thể chi tiết thông tin bảo trì hệ thống.
 * Quan hệ 1-1 (@OneToOne) với SystemConfig.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "system_maintenance_details")
public class SystemMaintenanceDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "system_config_id", nullable = false, unique = true)
    private SystemConfig systemConfig;

    @Column(name = "banner_message", length = 500)
    private String bannerMessage;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "expected_end_time")
    private LocalDateTime expectedEndTime;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
