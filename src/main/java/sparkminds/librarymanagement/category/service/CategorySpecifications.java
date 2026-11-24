package sparkminds.librarymanagement.category.service;

import org.springframework.data.jpa.domain.Specification;
import sparkminds.librarymanagement.category.entity.Category;

/**
 * Tiêu chí tìm danh mục cho trang quản trị. Quick search trên tên và mô tả, không phân biệt hoa thường.
 */
final class CategorySpecifications {

    private CategorySpecifications() {
    }

    static Specification<Category> search(String query) {
        return (root, criteriaQuery, criteriaBuilder) -> {
            if (query == null || query.isBlank()) {
                return criteriaBuilder.conjunction();
            }
            String like = "%" + query.toLowerCase() + "%";
            return criteriaBuilder.or(
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), like),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("description")), like)
            );
        };
    }
}
