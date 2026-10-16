package sparkminds.librarymanagement.book.service;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

/** Đọc và kiểm tra cấu trúc CSV trước khi service bắt đầu ghi bất kỳ dòng nào vào database. */
@Component
class BookImportCsvParser {

    private static final byte[] UTF8_BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final List<String> REQUIRED_HEADERS = List.of(
            "title", "author", "total_quantity", "borrow_fee", "late_fee_per_day"
    );
    private static final Set<String> ALLOWED_HEADERS = Set.of(
            "title", "author", "total_quantity", "borrow_fee", "late_fee_per_day",
            "isbn", "publisher", "published_date"
    );
    private static final CSVFormat FORMAT = CSVFormat.RFC4180.builder()
            .setIgnoreEmptyLines(false)
            .get();

    /**
     * Parse toàn bộ file một lượt để phát hiện lỗi cú pháp trước khi có dòng nào được import.
     *
     * <p>File được giữ trong byte array đã bị giới hạn dưới 5 MiB; parser chỉ giữ một record
     * tại một thời điểm để file nhiều dòng ngắn không tạo danh sách CSV lớn trong bộ nhớ.
     *
     * @param content nội dung CSV đã qua kiểm tra phần mở rộng và kích thước
     * @return danh sách header theo đúng thứ tự trong file và số dòng dữ liệu
     */
    Layout validate(byte[] content) {
        try (CSVParser parser = open(content)) {
            Iterator<CSVRecord> records = parser.iterator();
            List<String> headers = readAndValidateHeader(records);
            int totalRows = 0;
            while (records.hasNext()) {
                records.next();
                totalRows++;
            }
            if (totalRows == 0) {
                throw invalidFile("EMPTY_BOOK_IMPORT_FILE", "File CSV không có dòng dữ liệu");
            }
            return new Layout(headers, totalRows);
        } catch (BusinessException exception) {
            throw exception;
        } catch (IOException | UncheckedIOException | IllegalArgumentException exception) {
            throw parseFailure(exception);
        }
    }

    /**
     * Parse lại file đã xác thực và gửi từng record cho bộ xử lý tuần tự.
     *
     * <p>Hai lượt parse tránh ghi một phần dữ liệu rồi mới phát hiện dấu nháy hỏng ở cuối file;
     * nội dung byte không đổi giữa hai lượt nên mỗi row vẫn được xử lý đúng một lần.
     *
     * @param content nội dung CSV đã được xác thực
     * @param layout header và số dòng đã thu được ở lượt parse đầu
     * @param rowConsumer nơi tiếp nhận từng dòng dữ liệu theo thứ tự file
     */
    void forEachRow(byte[] content, Layout layout, Consumer<BookImportRow> rowConsumer) {
        try (CSVParser parser = open(content)) {
            Iterator<CSVRecord> records = parser.iterator();
            List<String> headers = readAndValidateHeader(records);
            if (!headers.equals(layout.headers())) {
                throw new IllegalStateException("CSV header changed between parse passes");
            }

            int processedRows = 0;
            while (records.hasNext()) {
                CSVRecord record = records.next();
                processedRows++;
                LinkedHashMap<String, String> fields = new LinkedHashMap<>();
                for (int column = 0; column < headers.size(); column++) {
                    fields.put(headers.get(column), column < record.size() ? record.get(column) : null);
                }
                int rowNumber = physicalStartLine(parser.getCurrentLineNumber(), record);
                rowConsumer.accept(new BookImportRow(rowNumber, fields, record.size() == headers.size()));
            }
            if (processedRows != layout.totalRows()) {
                throw new IllegalStateException("CSV records changed between parse passes");
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (IOException | UncheckedIOException exception) {
            throw parseFailure(exception);
        }
    }

    private static CSVParser open(byte[] content) throws IOException {
        int offset = hasUtf8Bom(content) ? UTF8_BOM.length : 0;
        ByteArrayInputStream input = new ByteArrayInputStream(content, offset, content.length - offset);
        CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        return FORMAT.parse(new InputStreamReader(input, decoder));
    }

    private static boolean hasUtf8Bom(byte[] content) {
        return content.length >= UTF8_BOM.length
                && content[0] == UTF8_BOM[0]
                && content[1] == UTF8_BOM[1]
                && content[2] == UTF8_BOM[2];
    }

    private static List<String> readAndValidateHeader(Iterator<CSVRecord> records) {
        if (!records.hasNext()) {
            throw invalidFile("EMPTY_BOOK_IMPORT_FILE", "File CSV rỗng hoặc thiếu header");
        }

        CSVRecord headerRecord = records.next();
        List<String> headers = new ArrayList<>(headerRecord.size());
        Set<String> uniqueHeaders = new HashSet<>();
        for (String header : headerRecord) {
            if (header == null || header.isBlank() || !uniqueHeaders.add(header)) {
                throw invalidHeader("Header CSV bị trống hoặc trùng tên cột");
            }
            if (!ALLOWED_HEADERS.contains(header)) {
                throw invalidHeader("Header CSV có cột không được hỗ trợ: " + header);
            }
            headers.add(header);
        }
        if (!headers.containsAll(REQUIRED_HEADERS)) {
            throw invalidHeader("Thiếu một hoặc nhiều cột bắt buộc của file CSV");
        }
        return List.copyOf(headers);
    }

    private static int physicalStartLine(long currentLine, CSVRecord record) {
        int embeddedLineBreaks = 0;
        for (String value : record) {
            if (value == null) {
                continue;
            }
            for (int index = 0; index < value.length(); index++) {
                char character = value.charAt(index);
                if (character == '\r') {
                    embeddedLineBreaks++;
                    if (index + 1 < value.length() && value.charAt(index + 1) == '\n') {
                        index++;
                    }
                } else if (character == '\n') {
                    embeddedLineBreaks++;
                }
            }
        }
        return Math.toIntExact(currentLine - embeddedLineBreaks);
    }

    private static BusinessException parseFailure(Exception exception) {
        if (hasCause(exception, CharacterCodingException.class)) {
            return invalidFile("INVALID_BOOK_IMPORT_ENCODING", "File CSV phải được mã hóa UTF-8 hợp lệ");
        }
        return invalidFile("INVALID_BOOK_IMPORT_CSV", "Nội dung CSV không hợp lệ hoặc không đọc được");
    }

    private static boolean hasCause(Throwable exception, Class<? extends Throwable> type) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (type.isInstance(cause)) {
                return true;
            }
        }
        return false;
    }

    private static BusinessException invalidHeader(String message) {
        return invalidFile("INVALID_BOOK_IMPORT_HEADER", message);
    }

    private static BusinessException invalidFile(String code, String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, code, message);
    }

    record Layout(List<String> headers, int totalRows) {
    }
}
