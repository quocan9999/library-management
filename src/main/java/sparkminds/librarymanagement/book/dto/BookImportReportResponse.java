package sparkminds.librarymanagement.book.dto;

import java.util.List;

public record BookImportReportResponse(
        int totalRows,
        int importedRows,
        int failedRows,
        List<BookImportErrorResponse> errors,
        int omittedErrorCount
) {
    public BookImportReportResponse {
        errors = List.copyOf(errors);
    }
}
