package sparkminds.librarymanagement.book.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.book.dto.BookDetailResponse;
import sparkminds.librarymanagement.book.dto.BookListItemResponse;
import sparkminds.librarymanagement.book.dto.CreateBookRequest;
import sparkminds.librarymanagement.book.dto.UpdateBookRequest;
import sparkminds.librarymanagement.book.service.BookService;
import sparkminds.librarymanagement.book.service.BookQueryService;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.common.api.PagedResponse;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/books")
@RequiredArgsConstructor
@Tag(name = "Admin Book Management", description = "Quản lý danh mục sách dành cho Admin có permission book tương ứng")
@SecurityRequirement(name = "bearerAuth")
public class BookController {

    private final BookService bookService;
    private final BookQueryService bookQueryService;

    @GetMapping
    @Operation(summary = "Tìm kiếm và phân trang sách", description = "Quick search, bộ lọc nâng cao, sort whitelist và phân trang tối đa 10 sách mỗi trang.")
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Trang sách đã lọc",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Tham số lọc hoặc sort không hợp lệ",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:read")
    })
    @PreAuthorize("hasAuthority('book:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<BookListItemResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String publisher,
            @RequestParam(required = false) String publishedFrom,
            @RequestParam(required = false) String publishedTo,
            @RequestParam(required = false) String availability,
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "BOOK_LIST_SUCCESS",
                "Lấy danh sách sách thành công",
                bookQueryService.search(q, publisher, publishedFrom, publishedTo, availability, page, size, sort)
        ));
    }

    @PostMapping
    @Operation(
            summary = "Tạo đầu sách",
            description = "Chuẩn hóa ISBN, khởi tạo tồn kho khả dụng và yêu cầu xác nhận nếu trùng tên/tác giả không ISBN.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateBookRequest.class),
                            examples = @ExampleObject(name = "Tạo sách", value = """
                                    {"title":"Clean Code","author":"Robert C. Martin","isbn":"9780132350884","publisher":"Prentice Hall","publishedDate":"2008-08-01","totalQuantity":5,"borrowFee":10000.00,"lateFeePerDay":2000.00,"confirmSimilar":false}
                                    """))
            )
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Sách được tạo",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:create"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "ISBN đã dùng hoặc cần xác nhận sách tương tự",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ApiResponse.class), examples = {
                            @ExampleObject(name = "ISBN trùng", value = """
                                    {"success":false,"status":409,"code":"BOOK_ISBN_DUPLICATED","message":"ISBN đã được sử dụng","data":null,"errors":null,"timestamp":"2026-10-16T13:00:00Z"}
                                    """),
                            @ExampleObject(name = "Cần xác nhận sách tương tự", value = """
                                    {"success":false,"status":409,"code":"SIMILAR_BOOK_CONFIRMATION_REQUIRED","message":"Đã có sách không ISBN cùng tên và tác giả. Xác nhận để tiếp tục tạo sách mới.","data":null,"errors":null,"timestamp":"2026-10-16T13:00:00Z"}
                                    """)
                    })),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Validation không hợp lệ",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ApiResponse.class), examples = @ExampleObject(value = """
                            {"success":false,"status":422,"code":"VALIDATION_ERROR","message":"Dữ liệu không hợp lệ","data":null,"errors":{"title":"không được để trống"},"timestamp":"2026-10-16T13:00:00Z"}
                            """)))
    })
    @PreAuthorize("hasAuthority('book:create') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<BookDetailResponse>> create(@Valid @RequestBody CreateBookRequest request) {
        BookDetailResponse book = bookService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/books/" + book.id()))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(
                        HttpStatus.CREATED.value(),
                        "BOOK_CREATED",
                        "Tạo sách thành công",
                        book
                ));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết sách", description = "Trả chi tiết sách, tồn kho và version hiện tại để Admin dùng khi cập nhật.")
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Chi tiết sách",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:read"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy sách",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('book:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<BookDetailResponse>> get(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "BOOK_DETAIL_SUCCESS",
                "Lấy thông tin sách thành công",
                bookService.get(id)
        ));
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Cập nhật sách",
            description = "Gửi version đã đọc cùng dữ liệu mới; version cũ trả BOOK_VERSION_CONFLICT (409).",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = UpdateBookRequest.class),
                            examples = @ExampleObject(name = "Cập nhật sách", value = """
                                    {"title":"Clean Code, 2nd printing","author":"Robert C. Martin","isbn":"9780132350884","publisher":"Prentice Hall","publishedDate":"2008-08-01","totalQuantity":7,"borrowFee":10000.00,"lateFeePerDay":2000.00,"version":0}
                                    """))
            )
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Sách được cập nhật",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:update"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy sách"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "ISBN trùng hoặc version đã cũ",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Validation không hợp lệ",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('book:update') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<BookDetailResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateBookRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "BOOK_UPDATED",
                "Cập nhật thông tin sách thành công",
                bookService.update(id, request)
        ));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa sách", description = "Chỉ xóa sách chưa có lịch sử mượn. Có LoanItem sẽ trả BOOK_HAS_LOAN_HISTORY (409).")
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "204", description = "Sách đã được xóa"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:delete"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy sách"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Sách có lịch sử mượn",
                    content = @Content(schema = @Schema(implementation = ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('book:delete') and principal.roleCode != 'USER'")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        bookService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
