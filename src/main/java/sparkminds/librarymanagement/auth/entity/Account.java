package sparkminds.librarymanagement.auth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "accounts")
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "username", unique = true, length = 20)
    private String username;

    @Column(name = "email", unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "is_system_account", nullable = false)
    private boolean systemAccount;

    /** Tăng mỗi khi trạng thái tài khoản đổi để vô hiệu hóa JWT đã cấp trước đó. */
    @Column(name = "session_version", nullable = false)
    private long sessionVersion;

    @Column(name = "last_session_change_reason", nullable = false, length = 40)
    private String lastSessionChangeReason = "OTHER";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
