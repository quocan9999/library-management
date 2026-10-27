package sparkminds.librarymanagement.config.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import sparkminds.librarymanagement.auth.entity.Account;

import java.time.LocalDateTime;

/**
 * Thực thể ghi nhận lịch sử thay đổi cấu hình hệ thống.
 * Quan hệ N-1 (@ManyToOne) với SystemConfig và Account.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "system_config_histories")
public class SystemConfigHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "system_config_id", nullable = false)
    private SystemConfig systemConfig;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @Column(name = "action", nullable = false, length = 50)
    private String action;

    @Column(name = "reason", length = 255)
    private String reason;

    @Column(name = "detail", length = 1000)
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
