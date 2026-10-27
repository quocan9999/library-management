package sparkminds.librarymanagement.loan.dto;

import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public record BorrowItemResponse(
        Integer id, Integer bookId, String bookCode, String title, String author, String coverImageUrl,
        LoanItemStatus status, BigDecimal borrowFee, BigDecimal lateFeePerDay, BigDecimal paidBorrowFee,
        BigDecimal lateFee, Instant borrowedAt, LocalDate dueDate, Instant readyAt, Instant pickupExpiresAt,
        Instant returnedAt, int renewalCount, long version
) {
    public static BorrowItemResponse from(LoanItem item) {
        var book = item.getBook();
        return new BorrowItemResponse(item.getId(), book.getId(), book.getBookCode(), book.getTitle(), book.getAuthor(),
                book.getCoverImageUrl(), item.getStatus(), item.getBorrowFee(), item.getLateFeePerDay(),
                item.getPaidBorrowFee(), item.getLateFee(), utc(item.getBorrowedAt()), item.getDueDate(),
                utc(item.getReadyAt()), utc(item.getPickupExpiresAt()), utc(item.getReturnedAt()),
                item.getRenewalCount(), item.getVersion());
    }

    private static Instant utc(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}
