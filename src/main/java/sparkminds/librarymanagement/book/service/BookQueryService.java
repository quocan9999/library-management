package sparkminds.librarymanagement.book.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.book.dto.BookListItemResponse;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.PagedResponse;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class BookQueryService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final Set<String> SORT_FIELDS = Set.of(
            "bookCode", "isbn", "title", "author", "publisher", "publishedDate",
            "totalQuantity", "availableQuantity", "borrowFee", "lateFeePerDay", "createdAt", "updatedAt"
    );
    private static final Map<String, Sort.Direction> SORT_DIRECTIONS = Map.of(
            "asc", Sort.Direction.ASC,
            "desc", Sort.Direction.DESC
    );

    private final BookRepository bookRepository;

    /**
     * Tìm sách cho bảng Admin theo quick search, bộ lọc nâng cao, sort và trang hiện tại.
     *
     * <p>Parse/validate input trước khi tạo Specification; sort chỉ nhận field whitelist và luôn
     * thêm ID DESC để hai trang không đảo thứ tự khi nhiều sách có cùng giá trị sort. ISBN-10 hợp lệ
     * được chuẩn hóa trước khi so với ISBN-13 canonical lưu trong DB.
     *
     * @param q cụm tìm trong mã, ISBN, tên hoặc tác giả; blank được xem như không lọc
     * @param publisher một phần tên nhà xuất bản
     * @param publishedFrom ngày xuất bản bắt đầu, có tính cả ngày này
     * @param publishedTo ngày xuất bản kết thúc, có tính cả ngày này
     * @param availability ALL, AVAILABLE hoặc UNAVAILABLE
     * @param page chỉ số trang bắt đầu từ 0
     * @param size số kết quả trong trang, tối đa 10
     * @param sort field và hướng sort dạng field,asc|desc
     * @return trang BookListItem đã lọc và sắp xếp ổn định
     * @throws BusinessException nếu tham số tìm kiếm không hợp lệ
     */
    public PagedResponse<BookListItemResponse> search(
            String q,
            String publisher,
            String publishedFrom,
            String publishedTo,
            String availability,
            String page,
            String size,
            String sort
    ) {
        String query = optionalText(q);
        LocalDate from = parseDate(publishedFrom, "publishedFrom");
        LocalDate to = parseDate(publishedTo, "publishedTo");
        if (from != null && to != null && from.isAfter(to)) {
            throw invalid("publishedFrom phải nhỏ hơn hoặc bằng publishedTo");
        }

        BookSearchCriteria criteria = new BookSearchCriteria(
                query,
                normalizeIsbnQuery(query),
                optionalText(publisher),
                from,
                to,
                parseAvailability(availability)
        );
        PageRequest pageRequest = PageRequest.of(parsePage(page), parseSize(size), parseSort(sort));
        Page<BookListItemResponse> result = bookRepository.findAll(BookSpecifications.search(criteria), pageRequest)
                .map(BookMapper::toListItem);
        return PagedResponse.of(result.getContent(), result.getNumber(), result.getSize(), result.getTotalElements());
    }

    private static String normalizeIsbnQuery(String query) {
        if (query == null) {
            return null;
        }
        try {
            return BookRules.normalizeIsbn(query);
        } catch (IllegalArgumentException notAnIsbn) {
            return query;
        }
    }

    private static String optionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static LocalDate parseDate(String value, String field) {
        String text = optionalText(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException exception) {
            throw invalid(field + " phải có định dạng yyyy-MM-dd");
        }
    }

    private static BookSearchCriteria.Availability parseAvailability(String value) {
        String text = optionalText(value);
        if (text == null) {
            return BookSearchCriteria.Availability.ALL;
        }
        try {
            return BookSearchCriteria.Availability.valueOf(text.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw invalid("availability chỉ nhận ALL, AVAILABLE hoặc UNAVAILABLE");
        }
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
        return new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_BOOK_QUERY", message);
    }
}
