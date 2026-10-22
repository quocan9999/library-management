package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanStatus;
import sparkminds.librarymanagement.loan.entity.LoanOrigin;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record StaffBorrowResponse(String loanCode, String pickupReference, LoanStatus status, Instant createdAt,
                                  long version, LoanOrigin origin, LoanPaymentStatus paymentStatus,
                                  BigDecimal paymentAmount, Instant paymentExpiresAt, MemberIdentity member, List<BorrowItemResponse> items,
                                  List<Integer> preparingOverdueItemIds) {
    public record MemberIdentity(Integer id, String memberCode, String fullName) {
    }
}
