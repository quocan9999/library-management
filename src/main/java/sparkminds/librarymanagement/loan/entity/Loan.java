package sparkminds.librarymanagement.loan.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import sparkminds.librarymanagement.loan.service.LoanTimestampListener;
import sparkminds.librarymanagement.member.entity.Member;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@EntityListeners(LoanTimestampListener.class)
@Table(name = "loans")
public class Loan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "loan_code", nullable = false, unique = true, length = 30)
    private String loanCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "borrowed_at")
    private LocalDateTime borrowedAt;

    @Column(name = "pickup_reference", nullable = false, unique = true, length = 36, updatable = false)
    private String pickupReference;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @PrePersist
    void initializePickupReference() {
        // Mã giữ nguyên suốt yêu cầu; không dùng loanCode tuần tự làm bí mật trong QR.
        if (pickupReference == null) {
            pickupReference = UUID.randomUUID().toString();
        }
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private LoanStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
