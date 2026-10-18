package sparkminds.librarymanagement.book.service;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import sparkminds.librarymanagement.book.entity.Book;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Kết hợp quick search dạng OR với bộ lọc nâng cao dạng AND bằng Criteria API có bind tham số. */
public final class BookSpecifications {

    private BookSpecifications() {
    }

    /**
     * Tạo điều kiện tìm sách mà không nối nội dung người dùng vào SQL.
     *
     * <p>Quick search xét mã, ISBN, tên và tác giả theo OR; publisher, khoảng ngày và tình trạng tồn
     * được ghép bằng AND. Criteria API truyền giá trị tìm kiếm riêng khỏi cấu trúc truy vấn.
     *
     * @param criteria bộ lọc đã được parse và validate
     * @return Specification dùng cho truy vấn và count query phân trang
     */
    public static Specification<Book> search(BookSearchCriteria criteria) {
        return (root, query, builder) -> {
            List<Predicate> filters = new ArrayList<>();

            if (criteria.query() != null) {
                String queryText = criteria.query().toLowerCase(Locale.ROOT);
                String isbnText = criteria.isbnQuery().toLowerCase(Locale.ROOT);
                filters.add(builder.or(
                        contains(builder, root.get("bookCode"), queryText),
                        contains(builder, root.get("isbn"), isbnText),
                        contains(builder, root.get("title"), queryText),
                        contains(builder, root.get("author"), queryText)
                ));
            }

            if (criteria.publisher() != null) {
                filters.add(contains(builder, root.get("publisher"), criteria.publisher().toLowerCase(Locale.ROOT)));
            }
            if (criteria.publishedFrom() != null) {
                filters.add(builder.greaterThanOrEqualTo(root.get("publishedDate"), criteria.publishedFrom()));
            }
            if (criteria.publishedTo() != null) {
                filters.add(builder.lessThanOrEqualTo(root.get("publishedDate"), criteria.publishedTo()));
            }
            if (criteria.availability() == BookSearchCriteria.Availability.AVAILABLE) {
                filters.add(builder.greaterThan(root.get("availableQuantity"), 0));
            } else if (criteria.availability() == BookSearchCriteria.Availability.UNAVAILABLE) {
                filters.add(builder.equal(root.get("availableQuantity"), 0));
            }

            return builder.and(filters.toArray(Predicate[]::new));
        };
    }

    private static Predicate contains(CriteriaBuilder builder, Expression<String> field, String value) {
        Expression<String> nonNullField = builder.coalesce(field, "");
        return builder.greaterThan(builder.locate(builder.lower(nonNullField), value), 0);
    }
}
