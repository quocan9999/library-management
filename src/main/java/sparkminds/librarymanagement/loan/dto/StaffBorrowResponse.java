package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanStatus;

import java.time.Instant;
import java.util.List;

public record StaffBorrowResponse(String loanCode, String pickupReference, LoanStatus status, Instant createdAt,
                                  long version, MemberIdentity member, List<BorrowItemResponse> items,
                                  List<Integer> preparingOverdueItemIds) {
    public record MemberIdentity(Integer id, String memberCode, String fullName) {
    }
}
