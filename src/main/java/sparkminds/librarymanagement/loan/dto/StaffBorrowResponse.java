package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanStatus;
import sparkminds.librarymanagement.loan.entity.LoanOrigin;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO trả về thông tin yêu cầu mượn cho nhân viên thủ thư tại quầy.
 * Bổ sung refundedAmount và refundedAt ghi nhận hoàn tiền quầy.
 */
public record StaffBorrowResponse(
        String loanCode,
        String pickupReference,
        LoanStatus status,
        Instant createdAt,
        long version,
        LoanOrigin origin,
        LoanPaymentStatus paymentStatus,
        BigDecimal paymentAmount,
        Instant paymentExpiresAt,
        BigDecimal refundedAmount,
        Instant refundedAt,
        MemberIdentity member,
        List<BorrowItemResponse> items,
        List<Integer> preparingOverdueItemIds
) {
    public record MemberIdentity(Integer id, String memberCode, String fullName) {
    }
}
