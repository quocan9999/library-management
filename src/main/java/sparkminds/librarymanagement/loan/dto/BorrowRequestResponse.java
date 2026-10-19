package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.time.Instant;
import java.util.List;

public record BorrowRequestResponse(String loanCode, String pickupReference, LoanStatus status, Instant createdAt,
                                    long version, List<BorrowItemResponse> items) {
}
