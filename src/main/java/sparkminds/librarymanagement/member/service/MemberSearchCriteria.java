package sparkminds.librarymanagement.member.service;

import java.time.LocalDate;

public record MemberSearchCriteria(
        String fullName,
        String memberCode,
        String email,
        String phoneDigits,
        LocalDate birthFrom,
        LocalDate birthTo,
        String book,
        LoanItemStatusFilter borrowStatus,
        Boolean emailVerified,
        Boolean enabled,
        int page,
        int size,
        String sortColumn,
        String sortDirection
) {
    public enum LoanItemStatusFilter {
        ALL,
        BORROWED,
        RETURNED
    }
}
