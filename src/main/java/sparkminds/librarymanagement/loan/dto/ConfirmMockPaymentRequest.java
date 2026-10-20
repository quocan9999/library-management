package sparkminds.librarymanagement.loan.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record ConfirmMockPaymentRequest(
        @NotNull @PositiveOrZero Long expectedLoanVersion,
        @NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal confirmedAmount
) {
}
