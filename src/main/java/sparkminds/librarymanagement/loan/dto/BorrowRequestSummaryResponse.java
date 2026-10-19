package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.time.Instant;
import java.util.List;

public record BorrowRequestSummaryResponse(String loanCode, String pickupReference, LoanStatus aggregateStatus,
                                           Instant createdAt, long version, int itemCount,
                                           List<LoanItemStatus> statuses, List<BorrowItemResponse> items) {
}
