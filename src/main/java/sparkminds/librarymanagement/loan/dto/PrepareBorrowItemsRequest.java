package sparkminds.librarymanagement.loan.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record PrepareBorrowItemsRequest(
        @NotNull @Size(min = 1, max = 3) List<@NotNull @Positive Integer> itemIds
) {
}
