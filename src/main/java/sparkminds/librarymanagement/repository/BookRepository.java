package sparkminds.librarymanagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import sparkminds.librarymanagement.entity.Book;

public interface BookRepository extends JpaRepository<Book, Integer> {
}
