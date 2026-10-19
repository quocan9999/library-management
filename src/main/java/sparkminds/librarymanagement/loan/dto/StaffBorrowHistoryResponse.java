package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;
import sparkminds.librarymanagement.loan.entity.NotificationStatus;

import java.time.Instant;

public record StaffBorrowHistoryResponse(Long id, Integer loanItemId, LoanItemStatus fromStatus,
                                         LoanItemStatus toStatus, LoanItemEventReason reasonCode,
                                         Integer actorAccountId, String actorRoleCode, Instant occurredAt, String note,
                                         NotificationKind notificationKind, NotificationStatus notificationState,
                                         int notificationAttempts, Instant notificationNextAttemptAt,
                                         Instant notificationSentAt, String notificationLastErrorCode) {
}
