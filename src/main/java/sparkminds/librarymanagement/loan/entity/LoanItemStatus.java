package sparkminds.librarymanagement.loan.entity;

public enum LoanItemStatus {
    RESERVED,
    PREPARING,
    READY_FOR_PICKUP,
    BORROWED,
    RETURNED,
    CANCELLED,
    EXPIRED,
    REJECTED;

    public boolean isPending() {
        return this == RESERVED || this == PREPARING || this == READY_FOR_PICKUP;
    }

    public boolean isActive() {
        return isPending() || this == BORROWED;
    }
}
