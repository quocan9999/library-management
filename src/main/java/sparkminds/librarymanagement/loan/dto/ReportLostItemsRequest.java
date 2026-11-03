package sparkminds.librarymanagement.loan.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Yêu cầu báo mất sách tại quầy.
 * Danh sách itemIds gồm các sách độc giả làm mất để tịch thu cọc và trừ kho.
 */
public record ReportLostItemsRequest(
        @NotEmpty(message = "Danh sách sách báo mất không được để trống")
        List<@NotNull(message = "ID sách không hợp lệ") Integer> itemIds
) {}
