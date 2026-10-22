package sparkminds.librarymanagement.loan.entity;

public enum LoanItemStatus {
    WAITLISTED,
    RESERVED,
    PREPARING,
    READY_FOR_PICKUP,
    BORROWED,
    RETURNED,
    CANCELLED,
    EXPIRED,
    REJECTED;

    public boolean isPending() {
        return this == WAITLISTED || this == RESERVED || this == PREPARING || this == READY_FOR_PICKUP;
    }

    public boolean isActive() {
        return isPending() || this == BORROWED;
    }
}
