package sparkminds.librarymanagement.member.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record LoanHistoryItemResponse(
        Integer loanItemId,
        Integer loanId,
        String loanCode,
        String loanStatus,
        Integer bookId,
        String bookCode,
        String bookTitle,
        String bookAuthor,
        String isbn,
        String itemStatus,
        LocalDateTime borrowedAt,
        LocalDate dueDate,
        LocalDateTime returnedAt,
        BigDecimal borrowFee,
        BigDecimal lateFeePerDay,
        BigDecimal lateFee,
        BigDecimal recordedTotalFee
) {
}
