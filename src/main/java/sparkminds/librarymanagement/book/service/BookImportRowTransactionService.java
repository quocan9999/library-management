package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.dto.CreateBookRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/** Lưu từng dòng CSV trong transaction riêng do Spring quản lý. */
@Service
@RequiredArgsConstructor
class BookImportRowTransactionService {

    private final BookTransactionService bookTransactionService;

    /**
     * Kiểm tra và lưu một dòng CSV trong transaction độc lập.
     *
     * <p>Importer gọi method qua Spring proxy; nếu dòng lỗi, transaction của dòng đó rollback
     * trước khi vòng lặp bên ngoài ghi lỗi vào report và tiếp tục dòng kế tiếp.
     *
     * @param row một record CSV đã parse, kèm số dòng vật lý bắt đầu trong file
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void importRow(BookImportRow row) {
        bookTransactionService.create(toCreateRequest(row));
    }

    private static CreateBookRequest toCreateRequest(BookImportRow row) {
        if (!row.consistentColumnCount()) {
            throw invalid(null, "INVALID_COLUMN_COUNT", "Số cột của dòng không khớp với header CSV");
        }

        String title = BookRules.normalizeRequiredText(row.value("title"));
        if (title == null || title.isBlank()) {
            throw invalid("title", "INVALID_BOOK_IMPORT_ROW", "Tên sách là bắt buộc");
        }
        if (title.length() > 255) {
            throw invalid("title", "INVALID_BOOK_IMPORT_ROW", "Tên sách tối đa 255 ký tự");
        }

        String author = BookRules.normalizeRequiredText(row.value("author"));
        if (author == null || author.isBlank()) {
            throw invalid("author", "INVALID_BOOK_IMPORT_ROW", "Tác giả là bắt buộc");
        }
        if (author.length() > 150) {
            throw invalid("author", "INVALID_BOOK_IMPORT_ROW", "Tác giả tối đa 150 ký tự");
        }

        String isbn;
        try {
            isbn = BookRules.normalizeIsbn(row.value("isbn"));
        } catch (IllegalArgumentException exception) {
            throw invalid("isbn", "INVALID_BOOK_ISBN", "ISBN phải là ISBN-10 hoặc ISBN-13 hợp lệ");
        }

        String publisher = BookRules.normalizeOptionalText(row.value("publisher"));
        if (publisher != null && publisher.length() > 150) {
            throw invalid("publisher", "INVALID_BOOK_IMPORT_ROW", "Nhà xuất bản tối đa 150 ký tự");
        }

        LocalDate publishedDate = parseDate(row.value("published_date"));
        int totalQuantity = parseQuantity(row.value("total_quantity"));
        BigDecimal borrowFee = parseFee(row.value("borrow_fee"), "borrow_fee");
        BigDecimal lateFeePerDay = parseFee(row.value("late_fee_per_day"), "late_fee_per_day");

        return new CreateBookRequest(
                title,
                author,
                isbn,
                publisher,
                publishedDate,
                totalQuantity,
                borrowFee,
                lateFeePerDay,
                false
        );
    }

    private static int parseQuantity(String value) {
        String text = trim(value);
        if (text == null) {
            throw invalid("total_quantity", "INVALID_BOOK_IMPORT_ROW", "Tổng số lượng là bắt buộc");
        }
        try {
            int quantity = Integer.parseInt(text);
            if (quantity < 0) {
                throw invalid("total_quantity", "INVALID_BOOK_IMPORT_ROW", "Tổng số lượng không được âm");
            }
            return quantity;
        } catch (NumberFormatException exception) {
            throw invalid("total_quantity", "INVALID_BOOK_IMPORT_ROW", "Tổng số lượng phải là số nguyên hợp lệ");
        }
    }

    private static BigDecimal parseFee(String value, String field) {
        String text = trim(value);
        if (text == null) {
            throw invalid(field, "INVALID_BOOK_IMPORT_ROW", "Phí là bắt buộc");
        }
        try {
            BigDecimal fee = new BigDecimal(text);
            BigDecimal normalized = fee.stripTrailingZeros();
            int integerDigits = Math.max(normalized.precision() - normalized.scale(), 0);
            if (fee.signum() < 0 || normalized.scale() > 2 || integerDigits > 10) {
                throw invalid(field, "INVALID_BOOK_IMPORT_ROW", "Phí phải từ 0 đến tối đa 10 chữ số nguyên và 2 số thập phân");
            }
            return fee;
        } catch (NumberFormatException exception) {
            throw invalid(field, "INVALID_BOOK_IMPORT_ROW", "Phí phải là số hợp lệ");
        }
    }

    private static LocalDate parseDate(String value) {
        String text = trim(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException exception) {
            throw invalid("published_date", "INVALID_BOOK_IMPORT_ROW", "Ngày xuất bản phải theo định dạng yyyy-MM-dd");
        }
    }

    private static String trim(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static BookImportRowException invalid(String field, String code, String message) {
        return new BookImportRowException(field, code, message);
    }
}
