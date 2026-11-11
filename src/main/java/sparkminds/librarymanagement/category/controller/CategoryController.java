package sparkminds.librarymanagement.category.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.category.dto.CategoryResponse;
import sparkminds.librarymanagement.category.dto.CategorySummary;
import sparkminds.librarymanagement.category.dto.CreateCategoryRequest;
import sparkminds.librarymanagement.category.dto.UpdateCategoryRequest;
import sparkminds.librarymanagement.category.service.CategoryQueryService;
import sparkminds.librarymanagement.category.service.CategoryService;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.common.api.PagedResponse;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
@Tag(name = "Admin Category Management", description = "Quản lý danh mục sách dành cho Admin có permission category tương ứng")
@SecurityRequirement(name = "bearerAuth")
public class CategoryController {

    private final CategoryService categoryService;
    private final CategoryQueryService categoryQueryService;

    @GetMapping
    @Operation(summary = "Tìm kiếm và phân trang danh mục", description = "Quick search trên tên và mô tả, sort whitelist và phân trang tối đa 10 danh mục mỗi trang.")
    @PreAuthorize("hasAuthority('category:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<CategoryResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "CATEGORY_LIST_SUCCESS",
                "Lấy danh sách danh mục thành công",
                categoryQueryService.search(q, page, size, sort)
        ));
    }

    @GetMapping("/options")
    @Operation(summary = "Danh sách rút gọn danh mục", description = "Trả toàn bộ danh mục (id + tên) dùng cho dropdown gán danh mục sách. USER cũng được gọi để lọc sách theo danh mục.")
    @PreAuthorize("hasAuthority('category:read')")
    public ResponseEntity<ApiResponse<List<CategorySummary>>> options(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "CATEGORY_OPTIONS_SUCCESS",
                "Lấy danh sách danh mục thành công",
                categoryQueryService.options(q)
        ));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết danh mục", description = "Trả chi tiết danh mục, số sách tham chiếu và version hiện tại để Admin dùng khi cập nhật.")
    @PreAuthorize("hasAuthority('category:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<CategoryResponse>> get(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "CATEGORY_DETAIL_SUCCESS",
                "Lấy thông tin danh mục thành công",
                categoryQueryService.get(id)
        ));
    }

    @PostMapping
    @Operation(summary = "Tạo danh mục", description = "Tên danh mục bắt buộc, duy nhất không phân biệt hoa thường.")
    @PreAuthorize("hasAuthority('category:create') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<CategoryResponse>> create(@Valid @RequestBody CreateCategoryRequest request) {
        CategoryResponse category = categoryQueryService.get(categoryService.create(request).getId());
        return ResponseEntity.created(URI.create("/api/v1/categories/" + category.id()))
                .body(ApiResponse.success(
                        HttpStatus.CREATED.value(),
                        "CATEGORY_CREATED",
                        "Tạo danh mục thành công",
                        category
                ));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật danh mục", description = "Gửi version đã đọc cùng dữ liệu mới; version cũ trả CATEGORY_VERSION_CONFLICT (409).")
    @PreAuthorize("hasAuthority('category:update') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<CategoryResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateCategoryRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                HttpStatus.OK.value(),
                "CATEGORY_UPDATED",
                "Cập nhật danh mục thành công",
                categoryQueryService.get(categoryService.update(id, request).getId())
        ));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa danh mục", description = "Chỉ xóa danh mục chưa được gán cho sách nào. Còn sách tham chiếu sẽ trả CATEGORY_HAS_BOOKS (409).")
    @PreAuthorize("hasAuthority('category:delete') and principal.roleCode != 'USER'")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
