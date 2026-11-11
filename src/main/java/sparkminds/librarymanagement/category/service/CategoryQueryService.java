package sparkminds.librarymanagement.category.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.category.dto.CategoryResponse;
import sparkminds.librarymanagement.category.dto.CategorySummary;
import sparkminds.librarymanagement.category.repository.CategoryRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.PagedResponse;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Truy vấn danh mục cho trang quản trị: phân trang, quick search, sort whitelist và danh sách options.
 * Sort chỉ nhận field trong whitelist và luôn thêm ID DESC để trang dữ liệu ổn định.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CategoryQueryService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final Set<String> SORT_FIELDS = Set.of("name", "createdAt", "updatedAt");
    private static final Map<String, Sort.Direction> SORT_DIRECTIONS = Map.of(
            "asc", Sort.Direction.ASC,
            "desc", Sort.Direction.DESC
    );

    private final CategoryRepository categoryRepository;
    private final BookRepository bookRepository;

    /**
     * Tìm danh mục cho bảng Admin theo quick search, sort và trang hiện tại.
     *
     * @param q    cụm tìm trong tên hoặc mô tả; blank được xem như không lọc
     * @param page chỉ số trang bắt đầu từ 0
     * @param size số kết quả trong trang, tối đa 10
     * @param sort field và hướng sort dạng field,asc|desc
     * @return trang CategoryResponse đã lọc và sắp xếp ổn định
     * @throws BusinessException nếu tham số tìm kiếm không hợp lệ
     */
    public PagedResponse<CategoryResponse> search(String q, String page, String size, String sort) {
        String query = optionalText(q);
        PageRequest pageRequest = PageRequest.of(parsePage(page), parseSize(size), parseSort(sort));
        Page<CategoryResponse> result = categoryRepository
                .findAll(CategorySpecifications.search(query), pageRequest)
                .map(category -> CategoryMapper.toResponse(
                        category, bookRepository.countByCategoriesId(category.getId())));
        return PagedResponse.of(result.getContent(), result.getNumber(), result.getSize(), result.getTotalElements());
    }

    /**
     * Danh sách rút gọn toàn bộ danh mục (id + tên), dùng cho dropdown gán danh mục cho sách.
     * Có lọc nhanh theo q và luôn sắp theo tên để danh sách lựa chọn ổn định.
     */
    public List<CategorySummary> options(String q) {
        String query = optionalText(q);
        return categoryRepository.findAll(CategorySpecifications.search(query), Sort.by("name")).stream()
                .map(CategoryMapper::toSummary)
                .toList();
    }

    /** Chi tiết một danh mục kèm số sách đang tham chiếu. */
    public CategoryResponse get(Integer id) {
        return categoryRepository.findById(id)
                .map(category -> CategoryMapper.toResponse(
                        category, bookRepository.countByCategoriesId(id)))
                .orElseThrow(CategoryService::categoryNotFound);
    }

    private static String optionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static int parsePage(String value) {
        int page = parseInteger(value, 0, "page");
        if (page < 0) {
            throw invalid("page không được âm");
        }
        return page;
    }

    private static int parseSize(String value) {
        int size = parseInteger(value, DEFAULT_PAGE_SIZE, "size");
        if (size < 1 || size > DEFAULT_PAGE_SIZE) {
            throw invalid("size phải nằm trong khoảng 1 đến 10");
        }
        return size;
    }

    private static int parseInteger(String value, int defaultValue, String field) {
        String text = optionalText(value);
        if (text == null) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException exception) {
            throw invalid(field + " phải là số nguyên");
        }
    }

    private static Sort parseSort(String value) {
        String text = optionalText(value);
        String[] parts = text == null ? new String[]{"createdAt", "desc"} : text.split(",", -1);
        if (parts.length != 2) {
            throw invalid("sort phải theo dạng field,asc|desc");
        }
        String field = parts[0].trim();
        if (!SORT_FIELDS.contains(field)) {
            throw invalid("sort field không được hỗ trợ");
        }
        Sort.Direction direction = SORT_DIRECTIONS.get(parts[1].trim().toLowerCase(Locale.ROOT));
        if (direction == null) {
            throw invalid("sort direction chỉ nhận asc hoặc desc");
        }

        // ID DESC giải quyết các tie để cùng filter luôn trả trang ổn định.
        return Sort.by(new Sort.Order(direction, field), new Sort.Order(Sort.Direction.DESC, "id"));
    }

    private static BusinessException invalid(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY_QUERY", message);
    }
}
