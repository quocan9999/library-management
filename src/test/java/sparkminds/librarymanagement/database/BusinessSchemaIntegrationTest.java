package sparkminds.librarymanagement.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class BusinessSchemaIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migratesBusinessTablesWithFinalTypesConstraintsIndexesAndHistoryRules() {
        Integer tableCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name IN ('members', 'books', 'loans', 'loan_items')
                """, Integer.class);
        assertEquals(4, tableCount);

        List<String> columnTypes = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', column_name, '=', column_type)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND ((table_name = 'members' AND column_name IN ('id', 'account_id', 'date_of_birth', 'created_at', 'updated_at'))
                    OR (table_name = 'books' AND column_name IN ('id', 'total_quantity', 'available_quantity', 'borrow_fee', 'late_fee_per_day', 'published_date'))
                    OR (table_name = 'loans' AND column_name IN ('id', 'member_id', 'borrowed_at', 'due_date'))
                    OR (table_name = 'loan_items' AND column_name IN ('id', 'loan_id', 'book_id', 'borrow_fee', 'late_fee_per_day', 'late_fee', 'returned_at')))
                """, (rs, rowNum) -> rs.getString(1));
        Set<String> expectedTypes = Set.of(
                "members.id=int", "members.account_id=int", "members.date_of_birth=date",
                "members.created_at=datetime", "members.updated_at=datetime",
                "books.id=int", "books.total_quantity=int", "books.available_quantity=int",
                "books.borrow_fee=decimal(12,2)", "books.late_fee_per_day=decimal(12,2)", "books.published_date=date",
                "loans.id=int", "loans.member_id=int", "loans.borrowed_at=datetime", "loans.due_date=date",
                "loan_items.id=int", "loan_items.loan_id=int", "loan_items.book_id=int",
                "loan_items.borrow_fee=decimal(12,2)", "loan_items.late_fee_per_day=decimal(12,2)",
                "loan_items.late_fee=decimal(12,2)", "loan_items.returned_at=datetime");
        assertEquals(expectedTypes, new HashSet<>(columnTypes));
        assertEquals(expectedTypes.size(), columnTypes.size());

        List<String> uniqueIndexes = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR '+'))
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name IN ('members', 'books', 'loans', 'loan_items')
                  AND non_unique = 0
                  AND index_name <> 'PRIMARY'
                GROUP BY table_name, index_name
                ORDER BY table_name, index_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(Set.of(
                "members.account_id", "members.member_code",
                "books.book_code", "books.isbn", "loans.loan_code", "loan_items.loan_id+book_id"),
                new HashSet<>(uniqueIndexes));
        assertEquals(6, uniqueIndexes.size());

        List<String> nullableFields = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', column_name)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND ((table_name = 'members' AND column_name IN ('full_name', 'date_of_birth', 'phone', 'address'))
                    OR (table_name = 'books' AND column_name IN ('isbn', 'publisher', 'published_date'))
                    OR (table_name = 'loan_items' AND column_name = 'returned_at'))
                  AND is_nullable = 'YES'
                ORDER BY table_name, column_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(Set.of(
                "members.full_name", "members.date_of_birth", "members.phone", "members.address",
                "books.isbn", "books.publisher", "books.published_date", "loan_items.returned_at"),
                new HashSet<>(nullableFields));

        List<String> indexes = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '.', GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR '+'))
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name IN ('members', 'books', 'loans', 'loan_items')
                  AND non_unique = 1
                  AND index_name <> 'PRIMARY'
                GROUP BY table_name, index_name
                ORDER BY table_name, index_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(Set.of(
                "members.date_of_birth", "books.title", "books.author", "books.published_date",
                "loans.member_id+status", "loans.due_date", "loan_items.loan_id", "loan_items.book_id",
                "loan_items.book_id+status"), new HashSet<>(indexes));
        assertEquals(9, indexes.size());

        List<String> checkCounts = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '=', COUNT(*))
                FROM information_schema.table_constraints
                WHERE constraint_schema = DATABASE()
                  AND table_name IN ('members', 'books', 'loans', 'loan_items')
                  AND constraint_type = 'CHECK'
                GROUP BY table_name
                ORDER BY table_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(List.of("books=4", "loan_items=5", "loans=2"), checkCounts);

        List<String> deleteRules = jdbcTemplate.query("""
                SELECT CONCAT(table_name, '=', delete_rule)
                FROM information_schema.referential_constraints
                WHERE constraint_schema = DATABASE()
                  AND table_name IN ('members', 'loans', 'loan_items')
                ORDER BY table_name, constraint_name
                """, (rs, rowNum) -> rs.getString(1));
        assertEquals(List.of(
                "loan_items=RESTRICT", "loan_items=RESTRICT", "loans=RESTRICT", "members=RESTRICT"), deleteRules);

        String bookColumns = jdbcTemplate.queryForObject("""
                SELECT GROUP_CONCAT(column_name ORDER BY ordinal_position SEPARATOR ',')
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'books'
                """, String.class);
        assertTrue(bookColumns.contains("isbn"));
        assertTrue(!bookColumns.contains("copy_id"));

        String loanItemColumns = jdbcTemplate.queryForObject("""
                SELECT GROUP_CONCAT(column_name ORDER BY ordinal_position SEPARATOR ',')
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'loan_items'
                """, String.class);
        assertTrue(!loanItemColumns.contains("quantity"));
    }
}
