package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.time.Instant;

public record BorrowHistoryResponse(Long id, LoanItemStatus fromStatus, LoanItemStatus toStatus,
                                     LoanItemEventReason reasonCode, Instant occurredAt, String note) {
}
