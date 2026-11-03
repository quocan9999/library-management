package sparkminds.librarymanagement.book.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import sparkminds.librarymanagement.book.dto.CreateBookRequest;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Kiểm thử đơn vị cho chức năng import sách từ file CSV (BookImportService).
 * Bao gồm kiểm tra cấu trúc header, bắt buộc cột price, kiểm tra giá trị price > 0,
 * và trích xuất dữ liệu dòng lỗi để hỗ trợ xuất CSV dòng lỗi trên giao diện.
 */
@ExtendWith(MockitoExtension.class)
class BookImportServiceTests {

    private BookImportCsvParser csvParser;

    @Mock
    private BookTransactionService bookTransactionService;

    @Mock
    private BookRepository bookRepository;

    private BookImportRowTransactionService rowTransactionService;
    private BookImportService bookImportService;

    @BeforeEach
    void setUp() {
        csvParser = new BookImportCsvParser();
        rowTransactionService = new BookImportRowTransactionService(bookTransactionService);
        bookImportService = new BookImportService(csvParser, rowTransactionService, bookRepository);
    }

    @Test
    @DisplayName("Ném lỗi 400 khi header CSV thiếu cột bắt buộc 'price'")
    void importFile_rejectsHeaderMissingPrice() {
        String csv = "title,author,total_quantity,borrow_fee,late_fee_per_day\n" +
                "Sách Test,Tác giả Test,10,5000,2000\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "books.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> bookImportService.importFile(file))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Thiếu một hoặc nhiều cột bắt buộc của file CSV")
                .hasMessageContaining("price");

        verifyNoInteractions(bookTransactionService);
    }

    @Test
    @DisplayName("Báo lỗi dòng khi thiếu giá gốc sách (price rỗng) và ghi nhận rowData để xuất CSV lỗi")
    void importFile_rejectsRowWithMissingPrice() {
        String csv = "title,author,total_quantity,borrow_fee,price,late_fee_per_day\n" +
                "Sách Thiếu Giá,Tác giả A,10,5000,,2000\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "books.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)
        );

        var response = bookImportService.importFile(file);

        assertThat(response.totalRows()).isEqualTo(1);
        assertThat(response.importedRows()).isEqualTo(0);
        assertThat(response.failedRows()).isEqualTo(1);
        assertThat(response.errors()).hasSize(1);

        var error = response.errors().get(0);
        assertThat(error.rowNumber()).isEqualTo(2);
        assertThat(error.field()).isEqualTo("price");
        assertThat(error.code()).isEqualTo("BOOK_IMPORT_PRICE_REQUIRED");
        assertThat(error.message()).isEqualTo("Giá gốc sách là bắt buộc");
        assertThat(error.rowData()).containsEntry("title", "Sách Thiếu Giá");
        assertThat(error.rowData()).containsEntry("author", "Tác giả A");

        verifyNoInteractions(bookTransactionService);
    }

    @Test
    @DisplayName("Báo lỗi dòng khi giá gốc sách <= 0 (price = 0 hoặc âm) và ghi nhận rowData để xuất CSV lỗi")
    void importFile_rejectsRowWithZeroOrNegativePrice() {
        String csv = "title,author,total_quantity,borrow_fee,price,late_fee_per_day\n" +
                "Sách Giá Bằng Không,Tác giả B,10,5000,0,2000\n" +
                "Sách Giá Âm,Tác giả C,5,5000,-10000,2000\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "books.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)
        );

        var response = bookImportService.importFile(file);

        assertThat(response.totalRows()).isEqualTo(2);
        assertThat(response.importedRows()).isEqualTo(0);
        assertThat(response.failedRows()).isEqualTo(2);
        assertThat(response.errors()).hasSize(2);

        var error1 = response.errors().get(0);
        assertThat(error1.rowNumber()).isEqualTo(2);
        assertThat(error1.field()).isEqualTo("price");
        assertThat(error1.code()).isEqualTo("BOOK_IMPORT_PRICE_MUST_BE_POSITIVE");
        assertThat(error1.message()).isEqualTo("Giá gốc của sách trong file CSV phải lớn hơn 0đ");
        assertThat(error1.rowData()).containsEntry("price", "0");

        var error2 = response.errors().get(1);
        assertThat(error2.rowNumber()).isEqualTo(3);
        assertThat(error2.field()).isEqualTo("price");
        assertThat(error2.code()).isEqualTo("BOOK_IMPORT_PRICE_MUST_BE_POSITIVE");
        assertThat(error2.rowData()).containsEntry("price", "-10000");

        verifyNoInteractions(bookTransactionService);
    }

    @Test
    @DisplayName("Import thành công khi dòng có giá gốc sách hợp lệ (> 0)")
    void importFile_importsValidRowWithPrice() {
        String csv = "title,author,total_quantity,borrow_fee,price,late_fee_per_day\n" +
                "Sách Hợp Lệ,Tác giả D,10,5000,150000,2000\n";
        MockMultipartFile file = new MockMultipartFile(
                "file", "books.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)
        );

        var response = bookImportService.importFile(file);

        assertThat(response.totalRows()).isEqualTo(1);
        assertThat(response.importedRows()).isEqualTo(1);
        assertThat(response.failedRows()).isEqualTo(0);
        assertThat(response.errors()).isEmpty();

        ArgumentCaptor<CreateBookRequest> captor = ArgumentCaptor.forClass(CreateBookRequest.class);
        verify(bookTransactionService).create(captor.capture());

        CreateBookRequest captured = captor.getValue();
        assertThat(captured.title()).isEqualTo("Sách Hợp Lệ");
        assertThat(captured.author()).isEqualTo("Tác giả D");
        assertThat(captured.totalQuantity()).isEqualTo(10);
        assertThat(captured.borrowFee()).isEqualByComparingTo(new BigDecimal("5000"));
        assertThat(captured.price()).isEqualByComparingTo(new BigDecimal("150000"));
        assertThat(captured.lateFeePerDay()).isEqualByComparingTo(new BigDecimal("2000"));
    }
}
