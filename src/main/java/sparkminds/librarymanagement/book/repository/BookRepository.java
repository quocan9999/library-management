package sparkminds.librarymanagement.book.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import sparkminds.librarymanagement.book.entity.Book;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BookRepository extends JpaRepository<Book, Integer>, JpaSpecificationExecutor<Book> {
    // Tìm sách theo mã sách duy nhất.
    Optional<Book> findByBookCode(String bookCode);

    // Tìm sách theo ISBN.
    Optional<Book> findByIsbn(String isbn);

    // Kiểm tra mã sách đã tồn tại hay chưa.
    boolean existsByBookCode(String bookCode);

    // Kiểm tra ISBN đã tồn tại hay chưa.
    boolean existsByIsbn(String isbn);

    boolean existsByIsbnAndIdNot(String isbn, Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select book from Book book where book.id = :bookId")
    Optional<Book> findByIdForUpdate(@Param("bookId") Integer bookId);

    // Đếm số sách đang thuộc một danh mục; dùng để chặn xóa danh mục còn tham chiếu.
    long countByCategoriesId(Integer categoryId);

    /**
     * Nạp sách kèm danh mục theo tập ID để map DTO trong trang danh sách,
     * tránh N+1 lazy query cho quan hệ nhiều–nhiều.
     */
    @EntityGraph(attributePaths = "categories")
    List<Book> findAllByIdIn(Collection<Integer> ids);
}
