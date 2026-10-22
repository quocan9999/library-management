package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record BorrowRequestSummaryResponse(String loanCode, String pickupReference, LoanStatus aggregateStatus,
                                           Instant createdAt, long version, int itemCount,
                                           LoanPaymentStatus paymentStatus, BigDecimal paymentAmount,
                                           Instant paymentExpiresAt, List<LoanItemStatus> statuses,
                                           List<BorrowItemResponse> items) {
}
