package sparkminds.librarymanagement.category.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import sparkminds.librarymanagement.category.entity.Category;

public interface CategoryRepository extends JpaRepository<Category, Integer>, JpaSpecificationExecutor<Category> {

    // Tên danh mục phải duy nhất không phân biệt hoa thường.
    boolean existsByNameIgnoreCase(String name);

    // Kiểm tra trùng tên khi cập nhật, loại trừ chính danh mục đang sửa.
    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
}
