package sparkminds.librarymanagement.book.service;

import java.util.Map;

record BookImportRow(
        int rowNumber,
        Map<String, String> fields,
        boolean consistentColumnCount
) {
    String value(String field) {
        return fields.get(field);
    }
}
