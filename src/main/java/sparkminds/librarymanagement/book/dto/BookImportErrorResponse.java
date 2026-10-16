package sparkminds.librarymanagement.book.dto;

public record BookImportErrorResponse(
        int rowNumber,
        String field,
        String code,
        String message
) {
}
