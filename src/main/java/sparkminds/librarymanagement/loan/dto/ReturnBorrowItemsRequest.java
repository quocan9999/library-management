package sparkminds.librarymanagement.loan.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ReturnBorrowItemsRequest(
        @NotEmpty(message = "Danh sách sách cần trả không được để trống")
        List<@NotNull(message = "ID sách không hợp lệ") Integer> itemIds,

        @NotNull(message = "Phải xác nhận đã nhận sách vật lý tại quầy")
        Boolean physicalBookReceived,

        Boolean lateFeeCollected
) {}
