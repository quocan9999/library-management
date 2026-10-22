package sparkminds.librarymanagement.book.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import sparkminds.librarymanagement.book.entity.Book;

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
}
