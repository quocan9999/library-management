package sparkminds.librarymanagement.category.service;

import lombok.RequiredArgsConstructor;
import jakarta.persistence.OptimisticLockException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.category.dto.CreateCategoryRequest;
import sparkminds.librarymanagement.category.dto.UpdateCategoryRequest;
import sparkminds.librarymanagement.category.entity.Category;
import sparkminds.librarymanagement.category.repository.CategoryRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Thao tác ghi dữ liệu danh mục: tạo, cập nhật, xóa trong transaction.
 * Đồng thời cung cấp hàm tra cứu dùng chung để gán danh mục hợp lệ cho Book.
 */
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final BookRepository bookRepository;

    /**
     * Tạo danh mục mới sau khi chuẩn hóa tên và kiểm tra trùng tên (không phân biệt hoa thường).
     *
     * @throws BusinessException nếu tên danh mục đã tồn tại
     */
    @Transactional
    public Category create(CreateCategoryRequest request) {
        String name = normalizeRequiredText(request.name());
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            throw nameConflict();
        }
        Category category = new Category();
        category.setName(name);
        category.setDescription(normalizeOptionalText(request.description()));
        return categoryRepository.saveAndFlush(category);
    }

    /**
     * Cập nhật tên và mô tả danh mục. So sánh version client với version DB trước khi ghi;
     * flush ngay trong transaction để phát hiện cả cuộc đua sau lần đọc.
     *
     * @throws BusinessException nếu không tìm thấy, trùng tên, hoặc version đã cũ
     */
    @Transactional
    public Category update(Integer id, UpdateCategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(CategoryService::categoryNotFound);
        if (!Objects.equals(category.getVersion(), request.version())) {
            throw versionConflict();
        }
        String name = normalizeRequiredText(request.name());
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw nameConflict();
        }
        category.setName(name);
        category.setDescription(normalizeOptionalText(request.description()));
        try {
            categoryRepository.saveAndFlush(category);
        } catch (OptimisticLockingFailureException | OptimisticLockException staleVersion) {
            // Version vừa bị Admin khác cập nhật giữa lúc kiểm tra và flush.
            throw versionConflict();
        }
        return category;
    }

    /**
     * Xóa danh mục chưa được gán cho sách nào.
     *
     * <p>Kiểm tra số sách tham chiếu trước, sau đó xóa và flush trong cùng transaction;
     * FK RESTRICT trên book_categories là lớp bảo vệ cuối nếu sách vừa được gán đồng thời.
     *
     * @throws BusinessException nếu không tìm thấy hoặc danh mục còn sách tham chiếu
     */
    @Transactional
    public void delete(Integer id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(CategoryService::categoryNotFound);
        if (bookRepository.countByCategoriesId(id) > 0) {
            throw booksConflict();
        }
        categoryRepository.delete(category);
        // Flush trong transaction để FK RESTRICT chặn việc gán danh mục phát sinh sau bước kiểm tra.
        categoryRepository.flush();
    }

    /**
     * Tra cứu tập danh mục hợp lệ theo ID để Book gán; hàm dùng chung cho tạo và cập nhật sách.
     *
     * @param categoryIds tập ID danh mục client gửi lên; có thể rỗng
     * @return tập Category tương ứng, không trùng lặp
     * @throws FieldValidationException nếu có ID danh mục không tồn tại
     */
    public Set<Category> resolveValidCategories(Collection<Integer> categoryIds) {
        if (categoryIds == null || categoryIds.isEmpty()) {
            return Set.of();
        }
        Set<Category> categories = new HashSet<>(categoryRepository.findAllById(categoryIds));
        if (categories.size() != new HashSet<>(categoryIds).size()) {
            Set<Integer> missing = categoryIds.stream()
                    .filter(id -> categories.stream().noneMatch(category -> category.getId().equals(id)))
                    .collect(Collectors.toSet());
            throw new FieldValidationException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "CATEGORY_VALIDATION_ERROR",
                    "Danh mục sách không hợp lệ",
                    Map.of("categoryIds", "Danh mục không tồn tại: " + missing)
            );
        }
        return categories;
    }

    /** Chuẩn hóa tên bắt buộc: bỏ khoảng trắng đầu/cuối và thu gọn khoảng trắng liên tiếp. */
    static String normalizeRequiredText(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new FieldValidationException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "CATEGORY_VALIDATION_ERROR",
                    "Dữ liệu danh mục không hợp lệ",
                    Map.of("name", "không được để trống")
            );
        }
        return normalized;
    }

    /** Chuẩn hóa văn bản tùy chọn; trả null khi chỉ toàn khoảng trắng. */
    static String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        return List.of(trimmed.split("\\s+")).stream().collect(Collectors.joining(" "));
    }

    static BusinessException categoryNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục");
    }

    private static BusinessException nameConflict() {
        return new BusinessException(HttpStatus.CONFLICT, "CATEGORY_NAME_DUPLICATED", "Tên danh mục đã được sử dụng");
    }

    static BusinessException versionConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "CATEGORY_VERSION_CONFLICT",
                "Danh mục đã được Admin khác cập nhật. Tải lại dữ liệu trước khi thử lại."
        );
    }

    private static BusinessException booksConflict() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "CATEGORY_HAS_BOOKS",
                "Không thể xóa danh mục đang có sách tham chiếu"
        );
    }
}
