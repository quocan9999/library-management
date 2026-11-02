package sparkminds.librarymanagement.loan.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import sparkminds.librarymanagement.loan.service.LoanTimestampListener;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.auth.entity.Account;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Entity đại diện cho một cuốn sách cụ thể trong yêu cầu mượn.
 * Lưu vết phí mượn, tiền cọc, ngày trả, và trạng thái hoàn cọc/tịch thu cọc.
 * Bắt buộc sử dụng Lombok cho Getter/Setter/NoArgsConstructor.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@EntityListeners(LoanTimestampListener.class)
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

    /** Tiền đặt cọc của cuốn sách, được snapshot từ giá gốc (book.price) lúc tạo đơn. */
    @Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal depositAmount = BigDecimal.ZERO;

    @Column(name = "late_fee_per_day", nullable = false, precision = 12, scale = 2)
    private BigDecimal lateFeePerDay;

    @Column(name = "late_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal lateFee = BigDecimal.ZERO;

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

    /** Số tiền cọc độc giả thực tế đã thanh toán. */
    @Column(name = "paid_deposit_amount", precision = 12, scale = 2)
    private BigDecimal paidDepositAmount;

    @Column(name = "borrow_fee_paid_at")
    private LocalDateTime borrowFeePaidAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "borrow_fee_confirmed_by_account_id")
    private Account borrowFeeConfirmedByAccount;

    /** Số tiền cọc đã hoàn trả lại cho độc giả khi trả sách tại quầy. */
    @Column(name = "deposit_refunded_amount", precision = 12, scale = 2)
    private BigDecimal depositRefundedAmount;

    /** Thời điểm hoàn cọc tại quầy. */
    @Column(name = "deposit_refunded_at")
    private LocalDateTime depositRefundedAt;

    /** Nhân viên thủ thư xác nhận hoàn cọc cho độc giả tại quầy. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deposit_refunded_by_account_id")
    private Account depositRefundedByAccount;

    /** Thời điểm ghi nhận tịch thu cọc khi báo mất sách (LOST). */
    @Column(name = "deposit_forfeited_at")
    private LocalDateTime depositForfeitedAt;

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

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
