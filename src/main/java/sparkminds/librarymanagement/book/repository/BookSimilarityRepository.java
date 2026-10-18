package sparkminds.librarymanagement.book.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class BookSimilarityRepository {

    private static final String SIMILAR_BOOK_EXISTS_SQL = """
            SELECT EXISTS (
                SELECT 1 FROM books
                WHERE isbn IS NULL
                  AND LOWER(REGEXP_REPLACE(TRIM(title), '[[:space:]]+', ' ')) = LOWER(?)
                  AND LOWER(REGEXP_REPLACE(TRIM(author), '[[:space:]]+', ' ')) = LOWER(?)
            )
            """;
    private static final String ACQUIRE_BOOK_IMPORT_LOCK_SQL = """
            SELECT id FROM book_similarity_lock WHERE id = 1 FOR UPDATE
            """;

    private final JdbcTemplate jdbcTemplate;

    /** Gộp khoảng trắng trong DB để cảnh báo sách không ISBN trùng tên/tác giả mà không chặn có ISBN. */
    public boolean existsWithoutIsbn(String title, String author) {
        Boolean exists = jdbcTemplate.queryForObject(SIMILAR_BOOK_EXISTS_SQL, Boolean.class, title, author);
        return Boolean.TRUE.equals(exists);
    }

    /**
     * Giữ một khóa database đến hết transaction create để serialize kiểm tra + insert sách không ISBN.
     *
     * <p>Khóa singleton làm cả hai request cùng kiểm tra ở database thấy được commit trước đó; nó
     * không phụ thuộc instance JVM hay advisory lock theo connection.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void acquireNoIsbnCreationLock() {
        jdbcTemplate.queryForObject(ACQUIRE_BOOK_IMPORT_LOCK_SQL, Integer.class);
    }
}
