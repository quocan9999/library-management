package sparkminds.librarymanagement.category.service;

import sparkminds.librarymanagement.category.dto.CategoryResponse;
import sparkminds.librarymanagement.category.dto.CategorySummary;
import sparkminds.librarymanagement.category.entity.Category;

import java.util.Comparator;

/**
 * Chuyển dữ liệu Category thành DTO công khai để API không trả trực tiếp JPA Entity.
 * Công khai cho BookMapper ở package book tái sử dụng khi map danh mục của sách.
 */
public final class CategoryMapper {

    private CategoryMapper() {
    }

    public static CategoryResponse toResponse(Category category, long bookCount) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getDescription(),
                bookCount,
                category.getCreatedAt(),
                category.getUpdatedAt(),
                category.getVersion()
        );
    }

    public static CategorySummary toSummary(Category category) {
        return new CategorySummary(category.getId(), category.getName());
    }

    /** Thứ tự hiển thị danh mục trong DTO sách: sắp theo tên, không phân biệt hoa thường. */
    public static Comparator<CategorySummary> byName() {
        return Comparator.comparing(summary -> summary.name().toLowerCase());
    }
}
