package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.time.Instant;

public record StaffBorrowHistoryResponse(Long id, Integer loanItemId, LoanItemStatus fromStatus,
                                         LoanItemStatus toStatus, LoanItemEventReason reasonCode,
                                         Integer actorAccountId, String actorRoleCode, Instant occurredAt, String note) {
}
