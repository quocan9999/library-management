package sparkminds.librarymanagement.book.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.book.entity.Book;

import java.util.Optional;

public interface BookRepository extends JpaRepository<Book, Integer> {
    // Tìm sách theo mã sách duy nhất.
    Optional<Book> findByBookCode(String bookCode);

    // Tìm sách theo ISBN.
    Optional<Book> findByIsbn(String isbn);

    // Kiểm tra mã sách đã tồn tại hay chưa.
    boolean existsByBookCode(String bookCode);

    // Kiểm tra ISBN đã tồn tại hay chưa.
    boolean existsByIsbn(String isbn);

    boolean existsByIsbnAndIdNot(String isbn, Integer id);
}
