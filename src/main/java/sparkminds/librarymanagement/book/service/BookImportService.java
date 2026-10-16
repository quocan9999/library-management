package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import sparkminds.librarymanagement.book.dto.BookImportErrorResponse;
import sparkminds.librarymanagement.book.dto.BookImportReportResponse;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class BookImportService {

    private static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    private static final int MAX_ERROR_DETAILS = 100;
    private static final String DUPLICATE_ISBN = "BOOK_ISBN_DUPLICATED";
    private static final String SIMILAR_BOOK = "SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION";

    private final BookImportCsvParser csvParser;
    private final BookImportRowTransactionService rowTransactionService;
    private final BookRepository bookRepository;

    /**
     * Kiểm tra file, parse đầy đủ rồi xử lý từng dòng dữ liệu độc lập.
     *
     * <p>Lượt parse đầu phát hiện file hỏng trước khi ghi database. Sau đó từng dòng được giao cho
     * bean transaction riêng để lỗi của một dòng không rollback các dòng đã lưu. Report luôn đếm
     * đủ số lỗi nhưng giới hạn chi tiết hiển thị để kích thước response không tăng theo số dòng lỗi.
     *
     * @param file file CSV người dùng tải lên
     * @return số dòng và tối đa 100 lỗi chi tiết; omittedErrorCount cho biết số chi tiết đã lược bỏ
     * @throws BusinessException nếu bản thân file không hợp lệ
     */
    public BookImportReportResponse importFile(MultipartFile file) {
        validateFilename(file);
        if (file.getSize() == 0) {
            throw invalidFile(HttpStatus.BAD_REQUEST, "EMPTY_BOOK_IMPORT_FILE", "File CSV rỗng");
        }
        if (file.getSize() >= MAX_FILE_BYTES) {
            throw invalidFile(HttpStatus.PAYLOAD_TOO_LARGE, "BOOK_IMPORT_FILE_TOO_LARGE", "File CSV phải nhỏ hơn 5 MiB");
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể đọc file CSV đã tải lên", exception);
        }
        if (content.length == 0) {
            throw invalidFile(HttpStatus.BAD_REQUEST, "EMPTY_BOOK_IMPORT_FILE", "File CSV rỗng");
        }
        if (content.length >= MAX_FILE_BYTES) {
            throw invalidFile(HttpStatus.PAYLOAD_TOO_LARGE, "BOOK_IMPORT_FILE_TOO_LARGE", "File CSV phải nhỏ hơn 5 MiB");
        }

        BookImportCsvParser.Layout layout = csvParser.validate(content);
        ImportCounts counts = new ImportCounts(layout.totalRows());
        csvParser.forEachRow(content, layout, row -> importRow(row, counts));
        return counts.toResponse();
    }

    private void importRow(BookImportRow row, ImportCounts counts) {
        try {
            rowTransactionService.importRow(row);
            counts.importedRows++;
        } catch (BookImportRowException exception) {
            counts.addError(row.rowNumber(), exception.getField(), exception.getCode(), exception.getMessage());
        } catch (BusinessException exception) {
            if (DUPLICATE_ISBN.equals(exception.getCode())) {
                counts.addError(row.rowNumber(), "isbn", DUPLICATE_ISBN, "ISBN đã được sử dụng; dòng này không được nhập");
            } else if ("SIMILAR_BOOK_CONFIRMATION_REQUIRED".equals(exception.getCode())) {
                counts.addError(row.rowNumber(), "title", SIMILAR_BOOK,
                        "Đã có sách không ISBN cùng tên và tác giả; hãy thêm thủ công để xác nhận");
            } else {
                throw exception;
            }
        } catch (DataIntegrityViolationException exception) {
            String isbn = normalizeIsbn(row.value("isbn"));
            if (isbn != null && bookRepository.existsByIsbn(isbn)) {
                counts.addError(row.rowNumber(), "isbn", DUPLICATE_ISBN, "ISBN đã được sử dụng; dòng này không được nhập");
                return;
            }
            throw exception;
        }
    }

    private static String normalizeIsbn(String value) {
        try {
            return BookRules.normalizeIsbn(value);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static void validateFilename(MultipartFile file) {
        if (file == null || file.getOriginalFilename() == null
                || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw invalidFile(HttpStatus.BAD_REQUEST, "INVALID_BOOK_IMPORT_FILE", "Chỉ chấp nhận file có phần mở rộng .csv");
        }
    }

    private static BusinessException invalidFile(HttpStatus status, String code, String message) {
        return new BusinessException(status, code, message);
    }

    private static final class ImportCounts {
        private final int totalRows;
        private final List<BookImportErrorResponse> errors = new ArrayList<>();
        private int importedRows;
        private int failedRows;
        private int omittedErrorCount;

        private ImportCounts(int totalRows) {
            this.totalRows = totalRows;
        }

        private void addError(int rowNumber, String field, String code, String message) {
            failedRows++;
            if (errors.size() < MAX_ERROR_DETAILS) {
                errors.add(new BookImportErrorResponse(rowNumber, field, code, message));
            } else {
                omittedErrorCount++;
            }
        }

        private BookImportReportResponse toResponse() {
            return new BookImportReportResponse(totalRows, importedRows, failedRows, errors, omittedErrorCount);
        }
    }
}
