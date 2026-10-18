package sparkminds.librarymanagement.book.entity;

import jakarta.persistence.Version;
import org.junit.jupiter.api.Test;
import sparkminds.librarymanagement.book.entity.Book;

import java.lang.reflect.Field;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class BookSchemaContractTests {

    @Test
    void bookUsesLongJpaVersionForOptimisticLocking() {
        Field version = Arrays.stream(Book.class.getDeclaredFields())
                .filter(field -> field.getName().equals("version"))
                .findFirst()
                .orElse(null);

        assertThat(version)
                .as("the Book row version protects edits from stale admin forms")
                .isNotNull();
        assertThat(version.getType()).isEqualTo(Long.class);
        assertThat(version.getAnnotation(Version.class)).isNotNull();
    }
}
