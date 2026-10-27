package sparkminds.librarymanagement.loan.entity;

public enum LoanItemEventReason {
    REQUEST_CREATED,
    /** @deprecated Legacy reason from waitlist queue; retained for historical audit trail. */
    @Deprecated
    QUEUE_PROMOTED,
    PREPARATION_STARTED,
    READY_CONFIRMED,
    USER_CANCELLED,
    COUNTER_CANCELLED,
    PICKUP_EXPIRED,
    PHYSICAL_COPY_UNAVAILABLE,
    HANDOVER_COMPLETED,
    MOCK_PAYMENT_CONFIRMED,
    PAYMENT_EXPIRED,
    RENEWAL_COMPLETED,
    RETURN_COMPLETED,
    LEGACY_IMPORTED,
    DUE_REMINDER_THREE_DAYS,
    DUE_REMINDER_TODAY,
    OVERDUE_REMINDER_FIRST_DAY
}
