package sparkminds.librarymanagement.loan.entity;

/**
 * Trạng thái của từng cuốn sách trong một yêu cầu mượn.
 * Bổ sung trạng thái LOST khi độc giả làm mất sách và thư viện tịch thu tiền cọc.
 */
public enum LoanItemStatus {
    RESERVED,
    PREPARING,
    READY_FOR_PICKUP,
    BORROWED,
    RETURNED,
    LOST,
    CANCELLED,
    EXPIRED,
    REJECTED;

    public boolean isPending() {
        return this == RESERVED || this == PREPARING || this == READY_FOR_PICKUP;
    }

    public boolean isActive() {
        return isPending() || this == BORROWED;
    }

    public boolean isCompleted() {
        return this == RETURNED || this == LOST;
    }
}
