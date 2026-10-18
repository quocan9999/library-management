package sparkminds.librarymanagement.book.service;

/** Lỗi dữ liệu thuộc riêng một dòng CSV; BookImportService chuyển lỗi này thành phần tử trong report. */
final class BookImportRowException extends RuntimeException {

    private final String field;
    private final String code;

    BookImportRowException(String field, String code, String message) {
        super(message);
        this.field = field;
        this.code = code;
    }

    String getField() {
        return field;
    }

    String getCode() {
        return code;
    }
}
