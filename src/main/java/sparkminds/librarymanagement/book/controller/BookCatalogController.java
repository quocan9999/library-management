package sparkminds.librarymanagement.book.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.book.dto.BookCatalogResponse;
import sparkminds.librarymanagement.book.service.BookCatalogService;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.common.api.PagedResponse;

@RestController
@RequestMapping("/api/v1/catalog/books")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('book:read')")
@Tag(name = "Book Catalog", description = "Danh mục sách dành cho tài khoản đã xác thực có permission book:read")
@SecurityRequirement(name = "bearerAuth")
public class BookCatalogController {

    private final BookCatalogService catalogService;

    @GetMapping
    @Operation(summary = "Tìm kiếm danh mục sách", description = "Trả danh sách sách tối thiểu cho catalog, hỗ trợ q, availability, phân trang và sort whitelist.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Trang sách trong catalog", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Tham số lọc, phân trang hoặc sort không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:read", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    public ResponseEntity<ApiResponse<PagedResponse<BookCatalogResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String availability,
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BOOK_CATALOG_LIST_SUCCESS", "Lấy danh mục sách thành công",
                catalogService.search(q, availability, page, size, sort)));
    }

    @GetMapping("/{bookId}")
    @Operation(summary = "Xem chi tiết sách trong catalog", description = "Chỉ trả trường catalog dành cho người mượn; không dùng DTO quản trị sách.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Chi tiết sách catalog", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có permission book:read", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy sách", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    public ResponseEntity<ApiResponse<BookCatalogResponse>> get(@PathVariable Integer bookId) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BOOK_CATALOG_DETAIL_SUCCESS", "Lấy thông tin sách thành công", catalogService.get(bookId)));
    }
}
