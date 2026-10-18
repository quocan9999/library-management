package sparkminds.librarymanagement.book.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class BookRulesTests {

    @Test
    void convertsIsbn10ToCanonicalIsbn13() {
        assertThat(BookRules.normalizeIsbn("0-306-40615-2")).isEqualTo("9780306406157");
    }

    @Test
    void keepsValid979Isbn13AndRemovesPresentationCharacters() {
        assertThat(BookRules.normalizeIsbn("979-1-234-56789-6")).isEqualTo("9791234567896");
    }

    @Test
    void rejectsInvalidChecksumAndNonIsbnEanPrefix() {
        assertThatIllegalArgumentException().isThrownBy(() -> BookRules.normalizeIsbn("9780306406158"));
        assertThatIllegalArgumentException().isThrownBy(() -> BookRules.normalizeIsbn("4006381333931"));
    }

    @Test
    void treatsBlankOptionalIsbnAsMissing() {
        assertThat(BookRules.normalizeIsbn("   ")).isNull();
    }
}
