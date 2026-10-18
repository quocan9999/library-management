package sparkminds.librarymanagement.integration.book;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
@Transactional
class BookSearchApiIntegrationTests {

    private static final LocalDateTime FIXTURE_CREATED_AT = LocalDateTime.of(2025, 1, 1, 12, 0);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    private String fixtureMarker;
    private String fixtureAuthor;
    private final List<Integer> fixtureIds = new ArrayList<>();

    @BeforeEach
    void verifyTestDatabaseAndInsertPagingFixtures() {
        String database = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        assertThat(database).matches("library_management(?:_[A-Za-z0-9]+)*_test");
        assertThat(datasourceUrl).endsWith("/" + database);

        fixtureMarker = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        fixtureAuthor = "Search Author " + fixtureMarker;
        fixtureIds.clear();
        for (int index = 0; index < 12; index++) {
            fixtureIds.add(insertBook(
                    bookCode("PAGE", index), null, "Paging Book " + String.format("%02d", index), fixtureAuthor,
                    "Press " + index % 2, LocalDate.of(2020, 1, 1).plusDays(index),
                    2, index % 2 == 0 ? 2 : 0, FIXTURE_CREATED_AT));
        }
    }

    @Test
    void searchRequiresBookReadAndAdminRole() throws Exception {
        mockMvc.perform(get("/api/v1/books"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        String adminToken = login("admin", "admin");
        mockMvc.perform(get("/api/v1/books").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("BOOK_LIST_SUCCESS"));

        jdbcTemplate.update("""
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
                WHERE r.code = 'USER' AND p.code = 'book:read'
                  AND NOT EXISTS (
                      SELECT 1 FROM role_permissions existing
                      WHERE existing.role_id = r.id AND existing.permission_id = p.id
                  )
                """);
        String userToken = login("user", "user");
        mockMvc.perform(get("/api/v1/books").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
    }

    @Test
    void defaultPageIsLimitedToTenAndStableAcrossTiedCreatedAtValues() throws Exception {
        String token = login("admin", "admin");

        MvcResult firstPage = mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", fixtureMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.totalElements").value(12))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.first").value(true))
                .andExpect(jsonPath("$.data.last").value(false))
                .andReturn();
        List<Integer> firstIds = JsonPath.read(firstPage.getResponse().getContentAsString(), "$.data.content[*].id");
        List<Integer> expectedIds = fixtureIds.stream().sorted(Comparator.reverseOrder()).limit(10).toList();
        assertThat(firstIds).containsExactlyElementsOf(expectedIds);

        MvcResult secondPage = mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", fixtureMarker)
                        .param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.totalElements").value(12))
                .andExpect(jsonPath("$.data.first").value(false))
                .andExpect(jsonPath("$.data.last").value(true))
                .andReturn();
        List<Integer> secondIds = JsonPath.read(secondPage.getResponse().getContentAsString(), "$.data.content[*].id");
        assertThat(secondIds).containsExactlyElementsOf(fixtureIds.stream().sorted(Comparator.reverseOrder()).skip(10).toList());
        assertThat(firstIds).doesNotContainAnyElementsOf(secondIds);

        mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", "  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(12));

        mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", fixtureMarker)
                        .param("size", "2")
                        .param("sort", "title,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].title").value("Paging Book 00"))
                .andExpect(jsonPath("$.data.content[1].title").value("Paging Book 01"));
        expectInvalidSearch(token, "size", "11");
    }

    @Test
    void quickSearchUsesOrAcrossFieldsAndDoesNotDuplicateBooks() throws Exception {
        String token = login("admin", "admin");
        String query = "Needle" + fixtureMarker;
        insertBook(bookCode("CODE" + query, 1), null, "Only code match", fixtureAuthor,
                "Reference Press", LocalDate.of(2020, 1, 1), 1, 1, FIXTURE_CREATED_AT);
        insertBook(bookCode("TITLE", 2), null, "Title contains " + query, fixtureAuthor,
                "Reference Press", LocalDate.of(2020, 1, 2), 1, 1, FIXTURE_CREATED_AT);
        insertBook(bookCode("AUTHOR", 3), null, "Only author match", query,
                "Reference Press", LocalDate.of(2020, 1, 3), 1, 1, FIXTURE_CREATED_AT);
        insertBook(bookCode(query, 4), null, query + " in code and title", fixtureAuthor,
                "Reference Press", LocalDate.of(2020, 1, 4), 1, 1, FIXTURE_CREATED_AT);

        MvcResult result = mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", query.toLowerCase(java.util.Locale.ROOT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(4))
                .andReturn();

        List<Integer> ids = JsonPath.read(result.getResponse().getContentAsString(), "$.data.content[*].id");
        assertThat(ids).hasSize(4).doesNotHaveDuplicates();
    }

    @Test
    void quickSearchConvertsValidIsbn10BeforeMatchingCanonicalIsbn13() throws Exception {
        String token = login("admin", "admin");
        insertBook(bookCode("ISBN", 1), "9780306406157", "ISBN search fixture", fixtureAuthor,
                "Reference Press", LocalDate.of(2020, 1, 1), 1, 1, FIXTURE_CREATED_AT);

        mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", "0-306-40615-2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].isbn").value("9780306406157"));
    }

    @Test
    void searchCombinesQuickSearchPublisherDateAndAvailabilityFiltersWithAnd() throws Exception {
        String token = login("admin", "admin");
        String query = "CrossFilter" + fixtureMarker;
        insertBook(bookCode("MATCH", 1), null, "Title " + query, fixtureAuthor,
                "Northwind Press", LocalDate.of(2025, 1, 1), 3, 3, FIXTURE_CREATED_AT);
        insertBook(bookCode("WRONG-PUBLISHER", 2), null, query + "", fixtureAuthor,
                "Southwind Press", LocalDate.of(2025, 6, 1), 3, 3, FIXTURE_CREATED_AT);
        insertBook(bookCode("WRONG-DATE", 3), null, query + "", fixtureAuthor,
                "Northwind Press", LocalDate.of(2024, 6, 1), 3, 3, FIXTURE_CREATED_AT);
        insertBook(bookCode("UNAVAILABLE", 4), null, query + "", fixtureAuthor,
                "Northwind Press", LocalDate.of(2025, 12, 31), 3, 0, FIXTURE_CREATED_AT);

        mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", query)
                        .param("publisher", "northwind")
                        .param("publishedFrom", "2025-01-01")
                        .param("publishedTo", "2025-12-31")
                        .param("availability", "AVAILABLE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].title").value("Title " + query));

        mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", query)
                        .param("publisher", "northwind")
                        .param("publishedFrom", "2025-01-01")
                        .param("publishedTo", "2025-12-31")
                        .param("availability", "UNAVAILABLE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].title").value(query));
    }

    @Test
    void searchTreatsSpecialCharactersLiterallyAndBindsInjectionLikeText() throws Exception {
        String token = login("admin", "admin");
        insertBook(bookCode("SPECIAL", 1), null, "Contains 100%_Needle " + fixtureMarker, fixtureAuthor,
                "Reference Press", LocalDate.of(2020, 1, 1), 1, 1, FIXTURE_CREATED_AT);
        insertBook(bookCode("WILDCARD-DECOY", 2), null, "Contains 100ZZNeedle " + fixtureMarker, fixtureAuthor,
                "Reference Press", LocalDate.of(2020, 1, 1), 1, 1, FIXTURE_CREATED_AT);

        mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", "100%_Needle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].title").value("Contains 100%_Needle " + fixtureMarker));

        mockMvc.perform(get("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .param("q", "%' OR 1=1 --"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0))
                .andExpect(jsonPath("$.data.content").isEmpty());
    }

    @Test
    void invalidDateAvailabilityPagingAndSortParametersReturnBadRequest() throws Exception {
        String token = login("admin", "admin");

        expectInvalidSearch(token, "publishedFrom", "2025-13-01");
        expectInvalidSearch(token, "publishedFrom", "2025-12-31", "publishedTo", "2025-01-01");
        expectInvalidSearch(token, "availability", "SOLD_OUT");
        expectInvalidSearch(token, "sort", "password,desc");
        expectInvalidSearch(token, "sort", "title,random");
        expectInvalidSearch(token, "page", "-1");
        expectInvalidSearch(token, "page", "nope");
        expectInvalidSearch(token, "size", "0");
        expectInvalidSearch(token, "size", "11");
    }

    private void expectInvalidSearch(String token, String... nameValuePairs) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/books")
                .header("Authorization", "Bearer " + token);
        for (int index = 0; index < nameValuePairs.length; index += 2) {
            request.param(nameValuePairs[index], nameValuePairs[index + 1]);
        }
        mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_BOOK_QUERY"));
    }

    private String login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"%s\",\"password\":\"%s\"}"
                                .formatted(username, password)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
    }

    private String bookCode(String suffix, int index) {
        return "S" + fixtureMarker.substring(0, 6) + "-" + suffix + "-" + index;
    }

    private Integer insertBook(
            String bookCode,
            String isbn,
            String title,
            String author,
            String publisher,
            LocalDate publishedDate,
            int totalQuantity,
            int availableQuantity,
            LocalDateTime createdAt
    ) {
        Timestamp timestamp = Timestamp.valueOf(createdAt);
        jdbcTemplate.update("""
                INSERT INTO books (
                    book_code, isbn, title, author, publisher, published_date,
                    total_quantity, available_quantity, borrow_fee, late_fee_per_day, version, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                bookCode, isbn, title, author, publisher, publishedDate,
                totalQuantity, availableQuantity, BigDecimal.ZERO, BigDecimal.ZERO, timestamp, timestamp);
        return jdbcTemplate.queryForObject("SELECT id FROM books WHERE book_code = ?", Integer.class, bookCode);
    }
}
