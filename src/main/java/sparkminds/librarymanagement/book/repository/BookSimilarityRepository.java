package sparkminds.librarymanagement.book.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

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

    private final JdbcTemplate jdbcTemplate;

    /** Gộp khoảng trắng trong DB để cảnh báo sách không ISBN trùng tên/tác giả mà không chặn có ISBN. */
    public boolean existsWithoutIsbn(String title, String author) {
        Boolean exists = jdbcTemplate.queryForObject(SIMILAR_BOOK_EXISTS_SQL, Boolean.class, title, author);
        return Boolean.TRUE.equals(exists);
    }
}
