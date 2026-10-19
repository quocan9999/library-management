package sparkminds.librarymanagement.loan.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record HandoverRequest(@NotNull Boolean identityVerified,
                              @NotNull @PositiveOrZero Long expectedLoanVersion,
                              @NotNull @Size(min = 1, max = 3) List<@NotNull @Valid PaymentItem> items) {
    public record PaymentItem(@NotNull @Positive Integer loanItemId,
                               @NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2)
                               BigDecimal collectedBorrowFee) {
    }
}
