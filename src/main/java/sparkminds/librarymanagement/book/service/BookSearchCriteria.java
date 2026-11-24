package sparkminds.librarymanagement.book.service;

import java.time.LocalDate;

public record BookSearchCriteria(
        String query,
        String isbnQuery,
        String publisher,
        LocalDate publishedFrom,
        LocalDate publishedTo,
        Availability availability,
        Integer categoryId
) {
    public enum Availability {
        ALL,
        AVAILABLE,
        UNAVAILABLE
    }
}
