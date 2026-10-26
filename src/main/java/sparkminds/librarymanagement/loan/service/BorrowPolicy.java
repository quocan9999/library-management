package sparkminds.librarymanagement.loan.service;

import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.util.Arrays;
import java.util.List;

public final class BorrowPolicy {
    public static final int MAX_ACTIVE_BOOKS = 3;
    public static final int MAX_REQUEST_BOOKS = 3;
    public static final List<LoanItemStatus> ACTIVE_STATUSES = Arrays.stream(LoanItemStatus.values())
            .filter(LoanItemStatus::isActive).toList();

    private BorrowPolicy() {
    }
}
