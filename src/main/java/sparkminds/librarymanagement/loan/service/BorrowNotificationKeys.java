package sparkminds.librarymanagement.loan.service;

import sparkminds.librarymanagement.loan.entity.NotificationKind;

import java.time.LocalDate;

public final class BorrowNotificationKeys {
    private BorrowNotificationKeys() {
    }

    public static String reminder(Integer itemId, LocalDate dueDate, NotificationKind kind) {
        return "item:" + itemId + ":due:" + dueDate + ":" + kind.name();
    }
}
