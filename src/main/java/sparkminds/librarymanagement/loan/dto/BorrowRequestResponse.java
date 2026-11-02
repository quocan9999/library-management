package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanStatus;
import sparkminds.librarymanagement.loan.entity.LoanPaymentMethod;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO trả về thông tin yêu cầu mượn cho độc giả.
 * Bổ sung refundedAmount và refundedAt ghi nhận hoàn tiền quầy.
 */
public record BorrowRequestResponse(
        String loanCode,
        String pickupReference,
        LoanStatus status,
        Instant createdAt,
        long version,
        LoanPaymentStatus paymentStatus,
        LoanPaymentMethod paymentMethod,
        BigDecimal paymentAmount,
        Instant paymentExpiresAt,
        Instant paidAt,
        BigDecimal refundedAmount,
        Instant refundedAt,
        List<BorrowItemResponse> items
) {
}
