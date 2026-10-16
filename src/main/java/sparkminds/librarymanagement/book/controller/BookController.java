package sparkminds.librarymanagement.book.controller;

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
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.book.dto.BookDetailResponse;
import sparkminds.librarymanagement.book.dto.CreateBookRequest;
import sparkminds.librarymanagement.book.dto.UpdateBookRequest;
import sparkminds.librarymanagement.book.service.BookService;
import sparkminds.librarymanagement.common.api.ApiResponse;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/books")
@RequiredArgsConstructor
public class BookController {

    private final BookService bookService;

    @PostMapping
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
    @PreAuthorize("hasAuthority('book:delete') and principal.roleCode != 'USER'")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        bookService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
