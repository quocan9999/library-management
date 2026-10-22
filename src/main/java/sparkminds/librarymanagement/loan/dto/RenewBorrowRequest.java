package sparkminds.librarymanagement.loan.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record RenewBorrowRequest(@NotNull @PositiveOrZero Long expectedItemVersion) {
}
