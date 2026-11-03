package sparkminds.librarymanagement.book.dto;

import java.util.Map;

/**
 * Chi tiết một dòng bị lỗi khi import sách từ file CSV.
 * rowData lưu giữ các trường dữ liệu ban đầu để hỗ trợ thủ thư xuất lại file CSV lỗi.
 */
public record BookImportErrorResponse(
        int rowNumber,
        String field,
        String code,
        String message,
        Map<String, String> rowData
) {
    public BookImportErrorResponse(int rowNumber, String field, String code, String message) {
        this(rowNumber, field, code, message, Map.of());
    }
}
