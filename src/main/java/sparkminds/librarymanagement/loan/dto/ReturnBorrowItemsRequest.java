package sparkminds.librarymanagement.loan.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Yêu cầu trả sách tại quầy.
 * Yêu cầu thủ thư xác nhận đã nhận sách vật lý và đã hoàn trả tiền cọc cho độc giả.
 */
public record ReturnBorrowItemsRequest(
        @NotEmpty(message = "Danh sách sách cần trả không được để trống")
        List<@NotNull(message = "ID sách không hợp lệ") Integer> itemIds,

        @NotNull(message = "Phải xác nhận đã nhận sách vật lý tại quầy")
        Boolean physicalBookReceived,

        @NotNull(message = "Phải xác nhận đã hoàn trả tiền cọc cho độc giả tại quầy")
        Boolean depositRefunded,

        Boolean lateFeeCollected
) {
    public ReturnBorrowItemsRequest(List<Integer> itemIds, Boolean physicalBookReceived, Boolean lateFeeCollected) {
        this(itemIds, physicalBookReceived, true, lateFeeCollected);
    }
}
