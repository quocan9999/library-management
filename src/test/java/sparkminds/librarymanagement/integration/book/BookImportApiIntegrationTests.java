package sparkminds.librarymanagement.integration.book;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Integration tests intentionally have no test transaction so each imported row must commit independently. */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class BookImportApiIntegrationTests {

    private static final String HEADER = "title,author,total_quantity,borrow_fee,late_fee_per_day,isbn,publisher,published_date\n";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    private String marker;
    private String adminToken;
    private boolean addedUserReadPermission;
    private boolean addedUserImportPermission;

    @BeforeEach
    void verifyTestDatabase() throws Exception {
        String database = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        assertThat(database).matches("library_management(?:_[A-Za-z0-9]+)*_test");
        assertThat(datasourceUrl).endsWith("/" + database);
        marker = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        adminToken = login("admin", "admin");
    }

    @AfterEach
    void removeFixtures() {
        if (marker != null) {
            jdbcTemplate.update("DELETE FROM books WHERE title LIKE ? OR author LIKE ?", "%" + marker + "%", "%" + marker + "%");
        }
        if (addedUserImportPermission) {
            removeRolePermission("book:import");
        }
        if (addedUserReadPermission) {
            removeRolePermission("book:read");
        }
        addedUserImportPermission = false;
        addedUserReadPermission = false;
    }

    @Test
    void importsValidRowsAndReportsDuplicateIsbnWithoutRollingBackOtherRows() throws Exception {
        String isbn10 = isbn10ForMarker(marker);
        String isbn13 = canonicalIsbn13(isbn10);
        String csv = HEADER
                + row("ISBN " + marker, "Author " + marker, "2", "100", "5", isbn10, "Press", "2025-01-02")
                + row("Duplicate " + marker, "Author " + marker, "3", "200", "6", isbn13, "Press", "2025-01-03")
                + row("No ISBN " + marker, "Author " + marker, "1", "0", "0", "", "", "");

        mockMvc.perform(multipart("/api/v1/books/import")
                        .file(new MockMultipartFile("file", "books.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("BOOK_IMPORT_PROCESSED"))
                .andExpect(jsonPath("$.data.totalRows").value(3))
                .andExpect(jsonPath("$.data.importedRows").value(2))
                .andExpect(jsonPath("$.data.failedRows").value(1))
                .andExpect(jsonPath("$.data.errors[0].rowNumber").value(3))
                .andExpect(jsonPath("$.data.errors[0].field").value("isbn"))
                .andExpect(jsonPath("$.data.errors[0].code").value("BOOK_ISBN_DUPLICATED"));

        assertThat(countBooksByMarker()).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT isbn FROM books WHERE title = ?", String.class, "ISBN " + marker))
                .isEqualTo(isbn13);
        Integer createdId = jdbcTemplate.queryForObject("SELECT id FROM books WHERE title = ?", Integer.class, "ISBN " + marker);
        assertThat(jdbcTemplate.queryForObject("SELECT book_code FROM books WHERE id = ?", String.class, createdId))
                .isEqualTo("B%06d".formatted(createdId));
        assertThat(jdbcTemplate.queryForObject("SELECT available_quantity FROM books WHERE title = ?", Integer.class, "No ISBN " + marker))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE book_code LIKE 'TMP-%'", Integer.class))
                .isZero();
    }

    @Test
    void importRequiresAuthenticationPermissionAndAdminRole() throws Exception {
        MockMultipartFile file = multipartFile("books.csv",
                (HEADER + row("Auth " + marker, "Author", "1", "0", "0", "", "", "")).getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(multipart("/api/v1/books/import").file(file))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));

        String userToken = login("user", "user");
        mockMvc.perform(multipart("/api/v1/books/import").file(file)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

        mockMvc.perform(multipart("/api/v1/books/import").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MISSING_REQUEST_PART"));

        addedUserReadPermission = addRolePermission("book:read");
        addedUserImportPermission = addRolePermission("book:import");
        userToken = login("user", "user");
        mockMvc.perform(multipart("/api/v1/books/import").file(file)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        assertThat(countBooksByMarker()).isZero();
    }

    @Test
    void allInvalidRowsReturnSuccessfulFileReportAndDoNotWriteBooks() throws Exception {
        String csv = HEADER
                + row("Bad quantity " + marker, "Author " + marker, "-1", "0", "0", "", "", "")
                + row("Bad date " + marker, "Author " + marker, "1", "0", "0", "", "", "2025-02-30")
                + row("Bad fee " + marker, "Author " + marker, "1", "-0.01", "0", "", "", "")
                + row("Large fee " + marker, "Author " + marker, "1", "0", "12345678901", "", "", "")
                + "Short," + marker + "\n";

        upload(csv)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Đã xử lý file: 0 sách được nhập, 5 dòng lỗi"))
                .andExpect(jsonPath("$.data.totalRows").value(5))
                .andExpect(jsonPath("$.data.importedRows").value(0))
                .andExpect(jsonPath("$.data.failedRows").value(5))
                .andExpect(jsonPath("$.data.errors.length()").value(5))
                .andExpect(jsonPath("$.data.errors[2].field").value("borrow_fee"))
                .andExpect(jsonPath("$.data.errors[3].field").value("late_fee_per_day"))
                .andExpect(jsonPath("$.data.errors[4].code").value("INVALID_COLUMN_COUNT"));

        assertThat(countBooksByMarker()).isZero();
    }

    @Test
    void skipsNoIsbnSimilarRowsAlreadyInDatabaseAndEarlierInTheSameFile() throws Exception {
        insertBook("Existing " + marker, "Author   " + marker, null);
        String csv = HEADER
                + row(" existing   " + marker + " ", " author " + marker + " ", "1", "0", "0", "", "", "")
                + row("Imported " + marker, "New Author " + marker, "2", "0", "0", "", "", "")
                + row(" imported " + marker + " ", "new   author " + marker, "3", "0", "0", "", "", "")
                + row("Other " + marker, "Other Author " + marker, "0", "0", "0", "", "", "");

        upload(csv)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows").value(4))
                .andExpect(jsonPath("$.data.importedRows").value(2))
                .andExpect(jsonPath("$.data.failedRows").value(2))
                .andExpect(jsonPath("$.data.errors[0].rowNumber").value(2))
                .andExpect(jsonPath("$.data.errors[0].code").value("SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION"))
                .andExpect(jsonPath("$.data.errors[1].rowNumber").value(4))
                .andExpect(jsonPath("$.data.errors[1].code").value("SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION"));

        assertThat(countBooksByMarker()).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE title = ?", Integer.class, "Imported " + marker))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT total_quantity FROM books WHERE title = ?", Integer.class, "Existing " + marker))
                .isEqualTo(1);
    }

    @Test
    void rejectsIsbnAlreadyStoredInDatabaseAndImportsOtherRows() throws Exception {
        String isbn10 = isbn10ForMarker(marker);
        String isbn13 = canonicalIsbn13(isbn10);
        insertBook("Existing ISBN " + marker, "Existing Author " + marker, isbn13);
        String csv = HEADER
                + row("Duplicate DB " + marker, "Author " + marker, "3", "0", "0", isbn10, "", "")
                + row("Other ISBN " + marker, "Author " + marker, "0", "0", "0", "", "", "");

        upload(csv)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows").value(2))
                .andExpect(jsonPath("$.data.importedRows").value(1))
                .andExpect(jsonPath("$.data.failedRows").value(1))
                .andExpect(jsonPath("$.data.errors[0].rowNumber").value(2))
                .andExpect(jsonPath("$.data.errors[0].code").value("BOOK_ISBN_DUPLICATED"));

        assertThat(countBooksByMarker()).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT title FROM books WHERE isbn = ?", String.class, isbn13))
                .isEqualTo("Existing ISBN " + marker);
    }

    @Test
    void acceptsUtf8BomReorderedHeadersAndQuotedMultilineFieldsWithPhysicalRowNumbers() throws Exception {
        String csv = "published_date,late_fee_per_day,author,title,borrow_fee,total_quantity\n"
                + "2025-03-04,2,\"Author " + marker + "\",\"Multi, \"\"quoted\"\"\ncontinued " + marker + "\",1,1\n"
                + "not-a-date,0,Author " + marker + ",Bad date " + marker + ",0,1\n";
        csv = csv.replace("\n", "\r\n");
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream withBom = new ByteArrayOutputStream(bytes.length + 3);
        withBom.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});
        withBom.write(bytes);

        mockMvc.perform(upload(multipartFile("books.csv", withBom.toByteArray())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows").value(2))
                .andExpect(jsonPath("$.data.importedRows").value(1))
                .andExpect(jsonPath("$.data.failedRows").value(1))
                .andExpect(jsonPath("$.data.errors[0].rowNumber").value(4))
                .andExpect(jsonPath("$.data.errors[0].field").value("published_date"));

        assertThat(jdbcTemplate.queryForObject("SELECT title FROM books WHERE author = ?", String.class, "Author " + marker))
                .isEqualTo("Multi, \"quoted\" continued " + marker);
    }

    @Test
    void rejectsInvalidFileHeadersEncodingAndExactlyFiveMibBeforeWriting() throws Exception {
        assertInvalidFile("books.txt", HEADER + row("Wrong extension", "Author", "1", "0", "0", "", "", ""), 400, "INVALID_BOOK_IMPORT_FILE");
        assertInvalidFile("empty.csv", new byte[0], 400, "EMPTY_BOOK_IMPORT_FILE");
        assertInvalidFile("header.csv", HEADER, 400, "EMPTY_BOOK_IMPORT_FILE");
        assertInvalidFile("missing.csv", "title,author,total_quantity\nOne,Author,1\n", 400, "INVALID_BOOK_IMPORT_HEADER");
        assertInvalidFile("extra.csv", HEADER.trim() + ",book_code\n", 400, "INVALID_BOOK_IMPORT_HEADER");
        assertInvalidFile("duplicate.csv", "title,author,total_quantity,borrow_fee,late_fee_per_day,title\n", 400, "INVALID_BOOK_IMPORT_HEADER");
        assertInvalidFile("malformed.csv", HEADER + "\"unterminated," + marker + ",1,0,0,,,,\n", 400, "INVALID_BOOK_IMPORT_CSV");
        String validThenMalformed = HEADER
                + row("Must not persist " + marker, "Author " + marker, "1", "0", "0", "", "", "")
                + "\"unterminated," + marker + ",1,0,0,,,,\n";
        assertInvalidFile("late-malformed.csv", validThenMalformed, 400, "INVALID_BOOK_IMPORT_CSV");

        byte[] invalidUtf8 = (HEADER + "Title," + marker + ",1,0,0,,,,\n").getBytes(StandardCharsets.UTF_8);
        invalidUtf8[HEADER.length() + 2] = (byte) 0xC3;
        invalidUtf8[HEADER.length() + 3] = (byte) 0x28;
        assertInvalidFile("charset.csv", invalidUtf8, 400, "INVALID_BOOK_IMPORT_ENCODING");

        byte[] exactLimit = new byte[5 * 1024 * 1024];
        assertInvalidFile("exact-size.csv", exactLimit, 413, "BOOK_IMPORT_FILE_TOO_LARGE");
        byte[] overLimit = new byte[5 * 1024 * 1024 + 1];
        assertInvalidFile("over-size.csv", overLimit, 413, "BOOK_IMPORT_FILE_TOO_LARGE");
        assertThat(countBooksByMarker()).isZero();
    }

    @Test
    void capsReturnedErrorDetailsAndReportsHowManyWereOmitted() throws Exception {
        StringBuilder csv = new StringBuilder(HEADER.length() + 5_000).append(HEADER);
        for (int index = 0; index < 101; index++) {
            csv.append(row("Bad " + marker + " " + index, "Author " + marker, "-1", "0", "0", "", "", ""));
        }

        upload(csv.toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows").value(101))
                .andExpect(jsonPath("$.data.importedRows").value(0))
                .andExpect(jsonPath("$.data.failedRows").value(101))
                .andExpect(jsonPath("$.data.errors.length()").value(100))
                .andExpect(jsonPath("$.data.omittedErrorCount").value(1));
        assertThat(countBooksByMarker()).isZero();
    }

    @Test
    void concurrentNoIsbnImportsSerializeSimilarityCheckAndInsert() throws Exception {
        String csv = HEADER + row("Concurrent " + marker, "Author " + marker, "1", "0", "0", "", "", "");
        Callable<MvcResult> request = () -> upload(csv).andReturn();
        var executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<MvcResult>> responses = executor.invokeAll(List.of(request, request));
            List<MvcResult> results = new ArrayList<>();
            for (Future<MvcResult> response : responses) {
                results.add(response.get());
            }

            List<Integer> importedCounts = results.stream()
                    .map(result -> com.jayway.jsonpath.JsonPath.<Integer>read(body(result), "$.data.importedRows"))
                    .toList();
            List<Integer> failedCounts = results.stream()
                    .map(result -> com.jayway.jsonpath.JsonPath.<Integer>read(body(result), "$.data.failedRows"))
                    .toList();
            assertThat(results).allSatisfy(result -> assertThat(result.getResponse().getStatus()).isEqualTo(200));
            assertThat(importedCounts).containsExactlyInAnyOrder(1, 0);
            assertThat(failedCounts).containsExactlyInAnyOrder(0, 1);
            assertThat(results.stream()
                    .filter(result -> com.jayway.jsonpath.JsonPath.<Integer>read(body(result), "$.data.failedRows") == 1)
                    .findFirst()
                    .orElseThrow()
                    .getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .contains("SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION");
        } finally {
            executor.shutdownNow();
        }
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE title = ?", Integer.class, "Concurrent " + marker))
                .isEqualTo(1);
    }

    @Test
    void concurrentDuplicateIsbnImportsReportOneConflictAndLeaveNoTemporaryBook() throws Exception {
        String isbn13 = canonicalIsbn13(isbn10ForMarker(marker));
        String csv = HEADER + row("Concurrent ISBN " + marker, "Author " + marker, "1", "0", "0", isbn13, "", "");
        Callable<MvcResult> request = () -> upload(csv).andReturn();
        var executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<MvcResult>> responses = executor.invokeAll(List.of(request, request));
            List<MvcResult> results = new ArrayList<>();
            for (Future<MvcResult> response : responses) {
                results.add(response.get());
            }

            assertThat(results).allSatisfy(result -> assertThat(result.getResponse().getStatus()).isEqualTo(200));
            List<Integer> importedCounts = results.stream()
                    .map(result -> com.jayway.jsonpath.JsonPath.<Integer>read(body(result), "$.data.importedRows"))
                    .toList();
            List<Integer> failedCounts = results.stream()
                    .map(result -> com.jayway.jsonpath.JsonPath.<Integer>read(body(result), "$.data.failedRows"))
                    .toList();
            assertThat(importedCounts).containsExactlyInAnyOrder(1, 0);
            assertThat(failedCounts).containsExactlyInAnyOrder(0, 1);
            assertThat(results.stream().map(BookImportApiIntegrationTests::body))
                    .anyMatch(response -> response.contains("BOOK_ISBN_DUPLICATED"));
        } finally {
            executor.shutdownNow();
        }
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE isbn = ?", Integer.class, isbn13))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE book_code LIKE 'TMP-%'", Integer.class))
                .isZero();
    }

    private String login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"%s\",\"password\":\"%s\"}"
                                .formatted(username, password)))
                .andExpect(status().isOk())
                .andReturn();
        return com.jayway.jsonpath.JsonPath.read(body(result), "$.data.accessToken");
    }

    private static String body(MvcResult result) {
        return new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
    }

    private ResultActions upload(String csv) throws Exception {
        return mockMvc.perform(upload(multipartFile("books.csv", csv.getBytes(StandardCharsets.UTF_8)))
                .header("Authorization", "Bearer " + adminToken));
    }

    private MockMultipartHttpServletRequestBuilder upload(MockMultipartFile file) {
        return multipart("/api/v1/books/import").file(file).header("Authorization", "Bearer " + adminToken);
    }

    private MockMultipartFile multipartFile(String filename, byte[] content) {
        return new MockMultipartFile("file", filename, "text/csv", content);
    }

    private void assertInvalidFile(String filename, String csv, int status, String code) throws Exception {
        assertInvalidFile(filename, csv.getBytes(StandardCharsets.UTF_8), status, code);
    }

    private void assertInvalidFile(String filename, byte[] csv, int status, String code) throws Exception {
        mockMvc.perform(upload(multipartFile(filename, csv)))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.code").value(code));
    }

    private boolean addRolePermission(String permission) {
        Integer existing = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = 'USER' AND p.code = ?
                """, Integer.class, permission);
        if (existing != null && existing > 0) {
            return false;
        }
        jdbcTemplate.update("""
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
                WHERE r.code = 'USER' AND p.code = ?
                """, permission);
        return true;
    }

    private void removeRolePermission(String permission) {
        jdbcTemplate.update("""
                DELETE rp FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = 'USER' AND p.code = ?
                """, permission);
    }

    private void insertBook(String title, String author, String isbn) {
        jdbcTemplate.update("""
                INSERT INTO books (
                    book_code, isbn, title, author, total_quantity, available_quantity,
                    borrow_fee, late_fee_per_day, version, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 1, 1, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, "T" + marker + "-FIXTURE", isbn, title, author);
    }

    private Integer countBooksByMarker() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE title LIKE ?", Integer.class, "%" + marker + "%");
    }

    private static String row(String... values) {
        return String.join(",", values) + "\n";
    }

    private static String isbn10ForMarker(String marker) {
        String digits = marker.replaceAll("[^0-9]", "") + "123456789";
        String firstNine = (digits + "123456789").substring(0, 9);
        int sum = 0;
        for (int index = 0; index < firstNine.length(); index++) {
            sum += (10 - index) * Character.digit(firstNine.charAt(index), 10);
        }
        int check = (11 - sum % 11) % 11;
        return firstNine + (check == 10 ? "X" : check);
    }

    private static String canonicalIsbn13(String isbn10) {
        String firstTwelve = "978" + isbn10.substring(0, 9);
        int sum = 0;
        for (int index = 0; index < firstTwelve.length(); index++) {
            sum += Character.digit(firstTwelve.charAt(index), 10) * (index % 2 == 0 ? 1 : 3);
        }
        return firstTwelve + (10 - sum % 10) % 10;
    }
}
