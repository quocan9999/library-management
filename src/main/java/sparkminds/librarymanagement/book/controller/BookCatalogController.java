package sparkminds.librarymanagement.book.controller;

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
public class BookCatalogController {

    private final BookCatalogService catalogService;

    @GetMapping
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
    public ResponseEntity<ApiResponse<BookCatalogResponse>> get(@PathVariable Integer bookId) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BOOK_CATALOG_DETAIL_SUCCESS", "Lấy thông tin sách thành công", catalogService.get(bookId)));
    }
}
