package sparkminds.librarymanagement.loan.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import sparkminds.librarymanagement.auth.entity.Account;

import java.time.LocalDateTime;

/** Trường nghiệp vụ chỉ ghi khi tạo; dispatcher chỉ được cập nhật metadata chuyển email. */
@Entity
@Table(name = "loan_item_status_history")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoanItemStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "loan_item_id", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LoanItem loanItem;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20, updatable = false)
    @Setter(AccessLevel.NONE)
    private LoanItemStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", length = 20, nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LoanItemStatus toStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_account_id", updatable = false)
    @Setter(AccessLevel.NONE)
    private Account actorAccount;

    @Column(name = "actor_role_code", length = 50, updatable = false)
    @Setter(AccessLevel.NONE)
    private String actorRoleCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_code", length = 50, nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LoanItemEventReason reasonCode;

    @Column(name = "note", length = 500, updatable = false)
    @Setter(AccessLevel.NONE)
    private String note;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime occurredAt;

    @Column(name = "notification_key", length = 160, unique = true, updatable = false)
    private String notificationKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_kind", length = 40, updatable = false)
    private NotificationKind notificationKind;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_state", length = 16)
    private NotificationStatus notificationState;

    @Column(name = "notification_attempts", nullable = false)
    private int notificationAttempts;

    @Column(name = "notification_next_attempt_at")
    private LocalDateTime notificationNextAttemptAt;

    @Column(name = "notification_sent_at")
    private LocalDateTime notificationSentAt;

    @Column(name = "notification_last_error_code", length = 80)
    private String notificationLastErrorCode;

    public LoanItemStatusHistory(LoanItem loanItem, LoanItemStatus fromStatus, LoanItemStatus toStatus,
                                 Account actorAccount, String actorRoleCode, LoanItemEventReason reasonCode,
                                 String note, LocalDateTime occurredAt) {
        this.loanItem = loanItem;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.actorAccount = actorAccount;
        this.actorRoleCode = actorRoleCode;
        this.reasonCode = reasonCode;
        this.note = note;
        this.occurredAt = occurredAt;
    }
}
