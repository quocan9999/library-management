package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.time.LocalDate;

public record BorrowRenewalResponse(Integer id, LoanItemStatus status, LocalDate dueDate, byte renewalCount, long version) {
}
