package sparkminds.librarymanagement.book.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import sparkminds.librarymanagement.book.dto.BookImportReportResponse;
import sparkminds.librarymanagement.book.service.BookImportService;
import sparkminds.librarymanagement.common.api.ApiResponse;

@RestController
@RequestMapping("/api/v1/books")
@RequiredArgsConstructor
public class BookImportController {

    private final BookImportService bookImportService;

    /** Nhận CSV và trả report; chỉ Admin có authority riêng `book:import` mới được chạy import. */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('book:import') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<BookImportReportResponse>> importCsv(@RequestParam("file") MultipartFile file) {
        BookImportReportResponse report = bookImportService.importFile(file);
        String message = "Đã xử lý file: %d sách được nhập, %d dòng lỗi"
                .formatted(report.importedRows(), report.failedRows());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(), "BOOK_IMPORT_PROCESSED", message, report));
    }
}
