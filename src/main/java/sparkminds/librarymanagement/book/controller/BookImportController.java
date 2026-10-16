package sparkminds.librarymanagement.book.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Admin Book Management")
@SecurityRequirement(name = "bearerAuth")
public class BookImportController {

    private final BookImportService bookImportService;

    /** Nhận CSV và trả report; chỉ Admin có authority riêng `book:import` mới được chạy import. */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Import sách bằng CSV",
            description = "Tải một file .csv UTF-8 dưới 5 MiB lên qua multipart field `file`. Mỗi dòng được xử lý độc lập; response 200 vẫn chứa report nếu toàn bộ dòng lỗi. Header: title,author,isbn,publisher,publishedDate,totalQuantity,borrowFee,lateFeePerDay."
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Report các dòng thành công và lỗi",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ApiResponse.class), examples = @ExampleObject(name = "Một dòng lỗi", value = """
                            {"success":true,"status":200,"code":"BOOK_IMPORT_PROCESSED","message":"Đã xử lý file: 1 sách được nhập, 1 dòng lỗi","data":{"totalRows":2,"importedRows":1,"failedRows":1,"errors":[{"rowNumber":3,"field":"isbn","code":"BOOK_ISBN_DUPLICATED","message":"ISBN đã được sử dụng; dòng này không được nhập"}],"omittedErrorCount":0},"errors":null,"timestamp":"2026-10-16T13:00:00Z"}
                            """))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Tên file, header hoặc CSV không hợp lệ",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:import"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "413", description = "File vượt giới hạn 5 MiB",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('book:import') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<BookImportReportResponse>> importCsv(@RequestParam("file") MultipartFile file) {
        BookImportReportResponse report = bookImportService.importFile(file);
        String message = "Đã xử lý file: %d sách được nhập, %d dòng lỗi"
                .formatted(report.importedRows(), report.failedRows());
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(), "BOOK_IMPORT_PROCESSED", message, report));
    }
}
