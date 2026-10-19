package sparkminds.librarymanagement.loan.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.auth.entity.Account;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "loan_items",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_loan_items_loan_book",
                        columnNames = {"loan_id", "book_id"}
                )
        }
)
public class LoanItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "loan_id", nullable = false)
    private Loan loan;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private LoanItemStatus status;

    @Column(name = "borrow_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal borrowFee;

    @Column(name = "late_fee_per_day", nullable = false, precision = 12, scale = 2)
    private BigDecimal lateFeePerDay;

    @Column(name = "late_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal lateFee = BigDecimal.ZERO;

    @Column(name = "waitlisted_at")
    private LocalDateTime waitlistedAt;

    @Column(name = "ready_at")
    private LocalDateTime readyAt;

    @Column(name = "pickup_expires_at")
    private LocalDateTime pickupExpiresAt;

    @Column(name = "borrowed_at")
    private LocalDateTime borrowedAt;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "renewal_count", nullable = false)
    private byte renewalCount;

    @Column(name = "paid_borrow_fee", precision = 12, scale = 2)
    private BigDecimal paidBorrowFee;

    @Column(name = "borrow_fee_paid_at")
    private LocalDateTime borrowFeePaidAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "borrow_fee_confirmed_by_account_id")
    private Account borrowFeeConfirmedByAccount;

    @Column(name = "late_fee_paid_at")
    private LocalDateTime lateFeePaidAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "late_fee_paid_by_account_id")
    private Account lateFeePaidByAccount;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
