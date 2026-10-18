package sparkminds.librarymanagement.integration.book;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.HttpMethod;
import sparkminds.librarymanagement.book.cover.BookCoverStorage;
import sparkminds.librarymanagement.book.cover.UploadedBookCover;
import sparkminds.librarymanagement.common.api.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.book.repository.BookRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class BookAdminApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoSpyBean
    private BookRepository bookRepository;

    @MockitoSpyBean
    private LoanItemRepository loanItemRepository;

    @MockitoBean
    private BookCoverStorage coverStorage;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    private String authorFixture;
    private String fixtureSuffix;
    private String userEmailFixture;
    private String userUsernameFixture;
    private String memberCodeFixture;
    private String loanCodeFixture;
    private boolean removeUserBookCreatePermission;
    private final List<Integer> refreshTokenIds = new ArrayList<>();

    @BeforeEach
    void verifyTestDatabaseAndPrepareFixture() {
        String database = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        assertThat(database).matches("library_management(?:_[A-Za-z0-9]+)*_test");
        assertThat(datasourceUrl).endsWith("/" + database);
        fixtureSuffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        authorFixture = "Book Admin " + fixtureSuffix;
        userEmailFixture = "book-user-" + fixtureSuffix + "@example.test";
        userUsernameFixture = "bku" + fixtureSuffix.substring(0, 10);
        memberCodeFixture = "BM-" + fixtureSuffix;
        loanCodeFixture = "BL-" + fixtureSuffix;
        removeUserBookCreatePermission = false;
        refreshTokenIds.clear();
    }

    @AfterEach
    void cleanOnlyFixturesCreatedByThisTest() {
        jdbcTemplate.update("DELETE li FROM loan_items li JOIN books b ON b.id = li.book_id WHERE b.author = ?", authorFixture);
        jdbcTemplate.update("DELETE FROM loan_items WHERE loan_id IN (SELECT id FROM loans WHERE loan_code = ?)", loanCodeFixture);
        jdbcTemplate.update("DELETE FROM loans WHERE loan_code = ?", loanCodeFixture);
        jdbcTemplate.update("DELETE FROM books WHERE author = ?", authorFixture);
        jdbcTemplate.update("DELETE FROM members WHERE member_code = ?", memberCodeFixture);
        for (Integer refreshTokenId : refreshTokenIds) {
            jdbcTemplate.update("DELETE FROM refresh_tokens WHERE id = ?", refreshTokenId);
        }
        jdbcTemplate.update("DELETE FROM refresh_tokens WHERE account_id = (SELECT id FROM accounts WHERE email = ?)",
                userEmailFixture);
        jdbcTemplate.update("DELETE FROM accounts WHERE email = ?", userEmailFixture);
        if (removeUserBookCreatePermission) {
            setUserBookCreatePermission(false);
        }
    }

    @Test
    void multipartCreateStoresCoverMetadataAndReturnsImageInDetailAndSearch() throws Exception {
        String token = loginAsSuperAdmin();
        stubCover("cover-created");
        MvcResult result = mockMvc.perform(coverRequest(HttpMethod.POST, "/api/v1/books",
                        createBookBody("Covered book", null, false)).header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.coverImageUrl").value("https://res.cloudinary.com/test/cover-created.png"))
                .andReturn();
        Integer id = JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
        assertThat(jdbcTemplate.queryForObject("SELECT cover_image_public_id FROM books WHERE id = ?", String.class, id))
                .isEqualTo("cover-created");
        mockMvc.perform(get("/api/v1/books/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.coverImageUrl").value("https://res.cloudinary.com/test/cover-created.png"))
                .andExpect(jsonPath("$.data.coverImagePublicId").doesNotExist());
        mockMvc.perform(get("/api/v1/books").param("q", authorFixture).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.content[0].coverImageUrl").value("https://res.cloudinary.com/test/cover-created.png"));
    }

    @Test
    void replacementDeletesOldCoverAfterCommitAndJsonUpdateKeepsCurrentImage() throws Exception {
        String token = loginAsSuperAdmin();
        Integer id = createCoveredBook(token, "old-cover");
        Long version = jdbcTemplate.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, id);
        stubCover("new-cover");
        doAnswer(invocation -> {
            assertThat(jdbcTemplate.queryForObject("SELECT cover_image_public_id FROM books WHERE id = ?", String.class, id))
                    .isEqualTo("new-cover");
            return null;
        }).when(coverStorage).delete("old-cover");
        mockMvc.perform(coverRequest(HttpMethod.PUT, "/api/v1/books/" + id, updateBookBody("Changed cover", 2, version))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value("https://res.cloudinary.com/test/new-cover.png"));
        verify(coverStorage).delete("old-cover");
        Long latest = jdbcTemplate.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, id);
        mockMvc.perform(put("/api/v1/books/{id}", id).header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON).content(updateBookBody("Only metadata", 2, latest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value("https://res.cloudinary.com/test/new-cover.png"));
        verify(coverStorage, never()).delete("new-cover");
    }

    @Test
    void staleCoverUpdateDiscardsNewUploadButPreservesExistingImageAndConflict() throws Exception {
        String token = loginAsSuperAdmin();
        Integer id = createCoveredBook(token, "existing-cover");
        Long version = jdbcTemplate.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, id);
        mockMvc.perform(put("/api/v1/books/{id}", id).header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON).content(updateBookBody("Concurrent edit", 2, version)))
                .andExpect(status().isOk());
        stubCover("discarded-cover");
        mockMvc.perform(coverRequest(HttpMethod.PUT, "/api/v1/books/" + id, updateBookBody("Stale edit", 2, version))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BOOK_VERSION_CONFLICT"));
        verify(coverStorage).delete("discarded-cover");
        verify(coverStorage, never()).delete("existing-cover");
        assertThat(jdbcTemplate.queryForObject("SELECT cover_image_public_id FROM books WHERE id = ?", String.class, id))
                .isEqualTo("existing-cover");
    }

    @Test
    void duplicateBookWithCoverRollsBackAndDiscardsUploadedImage() throws Exception {
        String token = loginAsSuperAdmin();
        createCoveredBook(token, "first-cover");
        stubCover("duplicate-cover");
        mockMvc.perform(coverRequest(HttpMethod.POST, "/api/v1/books", createBookBody("Cover fixture", null, false))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
        verify(coverStorage).delete("duplicate-cover");
        verify(coverStorage, never()).delete("first-cover");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture)).isEqualTo(1);
    }

    @Test
    void cloudinaryFailureDoesNotCreateBook() throws Exception {
        String token = loginAsSuperAdmin();
        when(coverStorage.upload(any())).thenThrow(new BusinessException(HttpStatus.BAD_GATEWAY,
                "BOOK_COVER_UPLOAD_FAILED", "Không thể tải ảnh bìa lên, vui lòng thử lại"));
        mockMvc.perform(coverRequest(HttpMethod.POST, "/api/v1/books", createBookBody("Failed upload", null, false))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("BOOK_COVER_UPLOAD_FAILED"));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture)).isZero();
    }

    @Test
    void deletingCoveredBookRemovesImageOnlyAfterDatabaseCommit() throws Exception {
        String token = loginAsSuperAdmin();
        Integer id = createCoveredBook(token, "delete-cover");
        doAnswer(invocation -> {
            assertThat(bookRepository.existsById(id)).isFalse();
            return null;
        }).when(coverStorage).delete("delete-cover");
        mockMvc.perform(delete("/api/v1/books/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        verify(coverStorage).delete("delete-cover");
    }

    @Test
    void databaseFailureAfterReplacingMetadataKeepsOldImageAndDiscardsNewUpload() throws Exception {
        String token = loginAsSuperAdmin();
        Integer id = createCoveredBook(token, "rollback-old");
        Long version = jdbcTemplate.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, id);
        stubCover("rollback-new");
        doAnswer(invocation -> {
            Book changed = invocation.getArgument(0);
            if ("rollback-new".equals(changed.getCoverImagePublicId())) {
                throw new DataIntegrityViolationException("Simulated database failure");
            }
            return invocation.callRealMethod();
        }).when(bookRepository).saveAndFlush(any(Book.class));
        mockMvc.perform(coverRequest(HttpMethod.PUT, "/api/v1/books/" + id, updateBookBody("Rolled back", 2, version))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
        verify(coverStorage).delete("rollback-new");
        verify(coverStorage, never()).delete("rollback-old");
        assertThat(jdbcTemplate.queryForObject("SELECT cover_image_public_id FROM books WHERE id = ?", String.class, id))
                .isEqualTo("rollback-old");
    }

    @Test
    void historyConflictPreservesBookCover() throws Exception {
        String token = loginAsSuperAdmin();
        Integer id = createCoveredBook(token, "history-cover");
        int loanId = createMemberAndLoanFixture();
        jdbcTemplate.update("""
                INSERT INTO loan_items (loan_id, book_id, status, borrow_fee, late_fee_per_day, late_fee)
                VALUES (?, ?, 'BORROWED', 0, 0, 0)
                """, loanId, id);
        mockMvc.perform(delete("/api/v1/books/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
        verify(coverStorage, never()).delete("history-cover");
        assertThat(jdbcTemplate.queryForObject("SELECT cover_image_public_id FROM books WHERE id = ?", String.class, id))
                .isEqualTo("history-cover");
    }

    @Test
    void multipartChecksAuthenticationRoleAndBeanValidationBeforeUploading() throws Exception {
        mockMvc.perform(coverRequest(HttpMethod.POST, "/api/v1/books", createBookBody("Anonymous", null, false)))
                .andExpect(status().isUnauthorized());
        String userToken = loginAsUser(true);
        mockMvc.perform(coverRequest(HttpMethod.POST, "/api/v1/books", createBookBody("User cover", null, false))
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
        String adminToken = loginAsSuperAdmin();
        mockMvc.perform(coverRequest(HttpMethod.POST, "/api/v1/books", createBookBody("", null, false))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isUnprocessableEntity());
        verifyNoInteractions(coverStorage);
    }

    private void stubCover(String publicId) {
        when(coverStorage.upload(any())).thenReturn(new UploadedBookCover("https://res.cloudinary.com/test/" + publicId + ".png", publicId));
    }

    private Integer createCoveredBook(String token, String publicId) throws Exception {
        stubCover(publicId);
        MvcResult result = mockMvc.perform(coverRequest(HttpMethod.POST, "/api/v1/books", createBookBody("Cover fixture", null, false))
                        .header("Authorization", "Bearer " + token)).andExpect(status().isCreated()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
    }

    private org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder coverRequest(
            HttpMethod method, String path, String body) throws Exception {
        java.io.ByteArrayOutputStream image = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2, 3, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", image);
        return org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart(method, path)
                .file(new MockMultipartFile("book", "", "application/json", body.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .file(new MockMultipartFile("cover", "cover.png", "image/png", image.toByteArray()));
    }

    @Test
    void multipartCreateRejectsFakeCoverWithoutSavingBook() throws Exception {
        String token = loginAsSuperAdmin();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/v1/books")
                        .file(new org.springframework.mock.web.MockMultipartFile("book", "", "application/json",
                                createBookBody("Fake cover", null, false).getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                        .file(new org.springframework.mock.web.MockMultipartFile("cover", "cover.png", "image/png",
                                "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.cover").exists());
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                .isZero();
    }

    @Test
    void adminCreateGeneratesBookCodeNormalizesIsbnAndSetsAvailableQuantity() throws Exception {
        String token = loginAsSuperAdmin();

        MvcResult response = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"title":"  Clean Code  ","author":"%s","isbn":"0-306-40615-2",
                                 "publisher":"  Prentice Hall  ","publishedDate":"2008-08-01",
                                 "totalQuantity":5,"borrowFee":150000,"lateFeePerDay":2500}
                                """.formatted(authorFixture)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("BOOK_CREATED"))
                .andExpect(jsonPath("$.data.bookCode").value(org.hamcrest.Matchers.matchesPattern("B\\d{6,}")))
                .andExpect(jsonPath("$.data.isbn").value("9780306406157"))
                .andExpect(jsonPath("$.data.title").value("Clean Code"))
                .andExpect(jsonPath("$.data.publisher").value("Prentice Hall"))
                .andExpect(jsonPath("$.data.availableQuantity").value(5))
                .andExpect(jsonPath("$.data.version").isNumber())
                .andReturn();

        assertThat(response.getResponse().getContentAsString()).doesNotContain("TMP-");
        Integer bookId = JsonPath.read(response.getResponse().getContentAsString(), "$.data.id");
        String responseBookCode = JsonPath.read(response.getResponse().getContentAsString(), "$.data.bookCode");
        assertThat(responseBookCode).isEqualTo("B" + String.format(java.util.Locale.ROOT, "%06d", bookId));
        assertThat(jdbcTemplate.queryForObject("SELECT book_code FROM books WHERE id = ?", String.class, bookId))
                .matches("B\\d{6,}");
    }

    @Test
    void adminCreateRejectsIsbnWithInvalidChecksum() throws Exception {
        String token = loginAsSuperAdmin();

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"title":"Invalid ISBN","author":"%s","isbn":"0-306-40615-3",
                                 "totalQuantity":1,"borrowFee":0,"lateFeePerDay":0}
                                """.formatted(authorFixture)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BOOK_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.isbn").exists());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                .isZero();
    }

    @Test
    void adminCreateRejectsNegativeQuantityAndOutOfRangeFees() throws Exception {
        String token = loginAsSuperAdmin();

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Negative quantity", null, false, -1)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.totalQuantity").exists());

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Negative fee", null, false, 1, "-0.01", "0")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.borrowFee").exists());

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Fee scale overflow", null, false, 1, "0", "1.001")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.lateFeePerDay").exists());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                .isZero();
    }

    @Test
    void adminCreateRejectsDuplicateIsbnAfterCanonicalNormalization() throws Exception {
        String token = loginAsSuperAdmin();

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("First ISBN copy", "0-306-40615-2", false)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Second ISBN copy", "978 0 306 40615 7", false)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOK_ISBN_DUPLICATED"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                .isEqualTo(1);
    }

    @Test
    void similarBookWithoutIsbnRequiresExplicitConfirmation() throws Exception {
        String token = loginAsSuperAdmin();

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("The   Clean Book", null, false)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody(" the clean  BOOK ", null, false)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SIMILAR_BOOK_CONFIRMATION_REQUIRED"));

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody(" the clean  BOOK ", null, true)))
                .andExpect(status().isCreated());
    }

    @Test
    void adminCanReadBookDetailAndMissingBookReturnsNotFound() throws Exception {
        String token = loginAsSuperAdmin();
        MvcResult created = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Detail view", null, false)))
                .andExpect(status().isCreated())
                .andReturn();
        Integer bookId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        mockMvc.perform(get("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("BOOK_DETAIL_SUCCESS"))
                .andExpect(jsonPath("$.data.id").value(bookId))
                .andExpect(jsonPath("$.data.bookCode").value(org.hamcrest.Matchers.matchesPattern("B\\d{6,}")));

        mockMvc.perform(get("/api/v1/books/{id}", 2_147_000_000)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOK_NOT_FOUND"));
    }

    @Test
    void adminUpdatePreservesUnavailableQuantityAndRejectsStaleOrInvalidChanges() throws Exception {
        String token = loginAsSuperAdmin();
        MvcResult created = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"title":"Inventory source","author":"%s","publisher":"Source Publisher",
                                 "publishedDate":"2020-01-01","totalQuantity":10,"borrowFee":0,"lateFeePerDay":0}
                                """.formatted(authorFixture)))
                .andExpect(status().isCreated())
                .andReturn();
        Integer bookId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
        Number originalVersionValue = JsonPath.read(created.getResponse().getContentAsString(), "$.data.version");
        Long originalVersion = originalVersionValue.longValue();
        jdbcTemplate.update("UPDATE books SET available_quantity = 6 WHERE id = ?", bookId);

        MvcResult updated = mockMvc.perform(put("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(updateBookBody("Inventory updated", 8, originalVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("BOOK_UPDATED"))
                .andExpect(jsonPath("$.data.totalQuantity").value(8))
                .andExpect(jsonPath("$.data.availableQuantity").value(4))
                .andExpect(jsonPath("$.data.publisher").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.publishedDate").value(org.hamcrest.Matchers.nullValue()))
                .andReturn();
        Number updatedVersionValue = JsonPath.read(updated.getResponse().getContentAsString(), "$.data.version");
        Long updatedVersion = updatedVersionValue.longValue();

        mockMvc.perform(put("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(updateBookBody("Stale overwrite", 8, originalVersion)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOK_VERSION_CONFLICT"));

        mockMvc.perform(put("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(updateBookBody("Inventory invalid", 3, updatedVersion)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BOOK_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.totalQuantity").exists());

        mockMvc.perform(get("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Inventory updated"))
                .andExpect(jsonPath("$.data.totalQuantity").value(8))
                .andExpect(jsonPath("$.data.availableQuantity").value(4));
    }

    @Test
    void adminUpdateRejectsAnIsbnAssignedToAnotherBook() throws Exception {
        String token = loginAsSuperAdmin();
        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("ISBN owner", "0-306-40615-2", false)))
                .andExpect(status().isCreated());

        MvcResult secondBook = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("ISBN update target", null, false)))
                .andExpect(status().isCreated())
                .andReturn();
        Integer secondBookId = JsonPath.read(secondBook.getResponse().getContentAsString(), "$.data.id");
        Long version = ((Number) JsonPath.read(secondBook.getResponse().getContentAsString(), "$.data.version")).longValue();

        mockMvc.perform(put("/api/v1/books/{id}", secondBookId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"title":"ISBN update target","author":"%s","isbn":"9780306406157",
                                 "publisher":null,"publishedDate":null,"totalQuantity":0,"borrowFee":0,
                                 "lateFeePerDay":0,"version":%d}
                                """.formatted(authorFixture, version)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOK_ISBN_DUPLICATED"));

        assertThat(jdbcTemplate.queryForObject("SELECT isbn FROM books WHERE id = ?", String.class, secondBookId))
                .isNull();
        assertThat(jdbcTemplate.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, secondBookId))
                .isEqualTo(version);
    }

    @Test
    void concurrentUpdatesWithTheSameVersionAllowOnlyOneWrite() throws Exception {
        String token = loginAsSuperAdmin();
        MvcResult created = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Concurrent update source", null, false, 2)))
                .andExpect(status().isCreated())
                .andReturn();
        Integer bookId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
        Long version = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.data.version")).longValue();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> firstUpdate = executor.submit(() -> concurrentUpdate(
                    token, bookId, "Concurrent update first", version, ready, start));
            Future<MvcResult> secondUpdate = executor.submit(() -> concurrentUpdate(
                    token, bookId, "Concurrent update second", version, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            MvcResult firstResponse = firstUpdate.get(15, TimeUnit.SECONDS);
            MvcResult secondResponse = secondUpdate.get(15, TimeUnit.SECONDS);
            assertThat(List.of(firstResponse.getResponse().getStatus(), secondResponse.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200, 409);
            MvcResult conflict = firstResponse.getResponse().getStatus() == 409 ? firstResponse : secondResponse;
            assertThat(JsonPath.<String>read(conflict.getResponse().getContentAsString(), "$.code"))
                    .isEqualTo("BOOK_VERSION_CONFLICT");
        } finally {
            start.countDown();
            executor.shutdownNow();
        }

        assertThat(jdbcTemplate.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, bookId))
                .isEqualTo(version + 1L);
        assertThat(jdbcTemplate.queryForObject("SELECT title FROM books WHERE id = ?", String.class, bookId))
                .isIn("Concurrent update first", "Concurrent update second");
    }

    @Test
    void adminCanDeleteBookWithoutLoanHistory() throws Exception {
        String token = loginAsSuperAdmin();
        MvcResult created = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Deletable book", null, false)))
                .andExpect(status().isCreated())
                .andReturn();
        Integer bookId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        mockMvc.perform(delete("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOK_NOT_FOUND"));
    }

    @Test
    void adminCannotDeleteBookWithLoanItemHistory() throws Exception {
        String token = loginAsSuperAdmin();
        MvcResult created = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Book with history", null, false)))
                .andExpect(status().isCreated())
                .andReturn();
        Integer bookId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
        int loanId = createMemberAndLoanFixture();
        jdbcTemplate.update("""
                        INSERT INTO loan_items (loan_id, book_id, status, borrow_fee, late_fee_per_day, late_fee)
                        VALUES (?, ?, 'BORROWED', 0, 0, 0)
                        """,
                loanId, bookId);

        mockMvc.perform(delete("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOK_HAS_LOAN_HISTORY"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE id = ?", Integer.class, bookId))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM loan_items WHERE loan_id = ?", Integer.class, loanId))
                .isEqualTo(1);
    }

    @Test
    void foreignKeyBlocksDeleteWhenLoanHistoryAppearsAfterPrecheck() throws Exception {
        String token = loginAsSuperAdmin();
        MvcResult created = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Book history race", null, false)))
                .andExpect(status().isCreated())
                .andReturn();
        Integer bookId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
        int loanId = createMemberAndLoanFixture();
        CountDownLatch historyChecked = new CountDownLatch(1);
        CountDownLatch allowDelete = new CountDownLatch(1);
        AtomicBoolean pauseFirstCheck = new AtomicBoolean(true);
        doAnswer(invocation -> {
            Integer checkedBookId = invocation.getArgument(0);
            boolean hasHistory = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM loan_items WHERE book_id = ?)", Boolean.class, checkedBookId));
            if (bookId.equals(checkedBookId) && pauseFirstCheck.compareAndSet(true, false)) {
                historyChecked.countDown();
                if (!allowDelete.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Delete history race fixture timed out");
                }
            }
            return hasHistory;
        }).when(loanItemRepository).existsByBookId(any(Integer.class));

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<MvcResult> deleteResponse = executor.submit(() -> mockMvc.perform(
                            delete("/api/v1/books/{id}", bookId)
                                    .header("Authorization", "Bearer " + token))
                    .andReturn());
            boolean reachedHistoryCheck = historyChecked.await(10, TimeUnit.SECONDS);
            if (!reachedHistoryCheck) {
                allowDelete.countDown();
                MvcResult earlyResponse = deleteResponse.get(15, TimeUnit.SECONDS);
                assertThat(reachedHistoryCheck)
                        .withFailMessage("DELETE returned before the loan-history check: status=%s, body=%s",
                                earlyResponse.getResponse().getStatus(),
                                earlyResponse.getResponse().getContentAsString())
                        .isTrue();
            }
            jdbcTemplate.update("""
                            INSERT INTO loan_items (loan_id, book_id, status, borrow_fee, late_fee_per_day, late_fee)
                            VALUES (?, ?, 'BORROWED', 0, 0, 0)
                            """,
                    loanId, bookId);
            allowDelete.countDown();

            MvcResult result = deleteResponse.get(15, TimeUnit.SECONDS);
            assertThat(result.getResponse().getStatus()).isEqualTo(409);
            assertThat(JsonPath.<String>read(result.getResponse().getContentAsString(), "$.code"))
                    .isEqualTo("BOOK_HAS_LOAN_HISTORY");
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE id = ?", Integer.class, bookId))
                    .isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM loan_items WHERE loan_id = ?", Integer.class, loanId))
                    .isEqualTo(1);
        } finally {
            allowDelete.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void unauthenticatedBookMutationReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/books")
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Unauthenticated book", null, false)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void userCannotCreateBookEvenWhenGrantedBookCreatePermission() throws Exception {
        String token = loginAsUser(true);

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("User role is blocked", null, false)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                .isZero();
    }

    @Test
    void concurrentCreatesGenerateDifferentBookCodes() throws Exception {
        String token = loginAsSuperAdmin();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentCreate(
                    token, "Concurrent first", null, ready, start));
            Future<MvcResult> second = executor.submit(() -> concurrentCreate(
                    token, "Concurrent second", null, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            MvcResult firstResult = first.get(15, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(15, TimeUnit.SECONDS);
            assertThat(List.of(firstResult.getResponse().getStatus(), secondResult.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(201, 201);
            String firstCode = JsonPath.read(firstResult.getResponse().getContentAsString(), "$.data.bookCode");
            String secondCode = JsonPath.read(secondResult.getResponse().getContentAsString(), "$.data.bookCode");
            assertThat(firstCode).matches("B\\d{6,}");
            assertThat(secondCode).matches("B\\d{6,}").isNotEqualTo(firstCode);
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                    .isEqualTo(2);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentCreatesWithSameIsbnKeepOnlyOneBook() throws Exception {
        String token = loginAsSuperAdmin();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentCreate(
                    token, "Duplicate ISBN first", "0-306-40615-2", ready, start));
            Future<MvcResult> second = executor.submit(() -> concurrentCreate(
                    token, "Duplicate ISBN second", "9780306406157", ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            MvcResult firstResult = first.get(15, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(15, TimeUnit.SECONDS);
            assertThat(List.of(firstResult.getResponse().getStatus(), secondResult.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(201, 409);
            MvcResult conflict = firstResult.getResponse().getStatus() == 409 ? firstResult : secondResult;
            assertThat(JsonPath.<String>read(conflict.getResponse().getContentAsString(), "$.code"))
                    .isEqualTo("BOOK_ISBN_DUPLICATED");
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                    .isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void failedBookCodeFinalizationRollsBackTemporaryInsert() throws Exception {
        String token = loginAsSuperAdmin();
        doAnswer(invocation -> {
            Book book = invocation.getArgument(0);
            Book saved = (Book) invocation.callRealMethod();
            if (book.getBookCode().startsWith("B")) {
                throw new DataIntegrityViolationException("fixture finalization failure");
            }
            return saved;
        }).when(bookRepository).saveAndFlush(any(Book.class));

        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody("Rollback book", null, false)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE author = ?", Integer.class, authorFixture))
                .isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM books WHERE book_code LIKE 'TMP-%'", Integer.class))
                .isZero();
    }

    private String loginAsSuperAdmin() throws Exception {
        return login("admin", "admin");
    }

    private String loginAsUser(boolean grantBookCreatePermission) throws Exception {
        if (grantBookCreatePermission && !hasUserBookCreatePermission()) {
            setUserBookCreatePermission(true);
            removeUserBookCreatePermission = true;
        }
        jdbcTemplate.update("""
                        INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                        SELECT ?, ?, ?, id, true, true FROM roles WHERE code = 'USER'
                        """,
                userUsernameFixture, userEmailFixture, passwordEncoder.encode("FixtureBook1!"));
        return login(userUsernameFixture, "FixtureBook1!");
    }

    private String login(String identifier, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"%s\",\"password\":\"%s\"}"
                                .formatted(identifier, password)))
                .andExpect(status().isOk())
                .andReturn();
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT id FROM accounts WHERE username = ? OR email = ? ORDER BY id LIMIT 1",
                Integer.class, identifier, identifier);
        Integer refreshTokenId = jdbcTemplate.queryForObject(
                "SELECT id FROM refresh_tokens WHERE account_id = ? ORDER BY id DESC LIMIT 1", Integer.class, accountId);
        refreshTokenIds.add(refreshTokenId);
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
    }

    private String createBookBody(String title, String isbn, boolean confirmSimilar) {
        return createBookBody(title, isbn, confirmSimilar, 0);
    }

    private String createBookBody(String title, String isbn, boolean confirmSimilar, int totalQuantity) {
        return createBookBody(title, isbn, confirmSimilar, totalQuantity, "0", "0");
    }

    private String createBookBody(
            String title,
            String isbn,
            boolean confirmSimilar,
            int totalQuantity,
            String borrowFee,
            String lateFeePerDay
    ) {
        String isbnValue = isbn == null ? "null" : "\"" + isbn + "\"";
        return """
                {"title":"%s","author":"%s","isbn":%s,"totalQuantity":%d,
                 "borrowFee":%s,"lateFeePerDay":%s,"confirmSimilar":%s}
                """.formatted(title, authorFixture, isbnValue, totalQuantity, borrowFee, lateFeePerDay, confirmSimilar);
    }

    private String updateBookBody(String title, int totalQuantity, Long version) {
        return """
                {"title":"%s","author":"%s","isbn":null,"publisher":null,"publishedDate":null,
                 "totalQuantity":%d,"borrowFee":0,"lateFeePerDay":0,"version":%d}
                """.formatted(title, authorFixture, totalQuantity, version);
    }

    private int createMemberAndLoanFixture() {
        jdbcTemplate.update("""
                        INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                        SELECT ?, ?, ?, id, true, true FROM roles WHERE code = 'USER'
                        """,
                userUsernameFixture, userEmailFixture, passwordEncoder.encode("FixtureBook1!"));
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT id FROM accounts WHERE email = ?", Integer.class, userEmailFixture);
        jdbcTemplate.update("""
                        INSERT INTO members (account_id, member_code, full_name)
                        VALUES (?, ?, 'Book history fixture')
                        """,
                accountId, memberCodeFixture);
        Integer memberId = jdbcTemplate.queryForObject(
                "SELECT id FROM members WHERE member_code = ?", Integer.class, memberCodeFixture);
        jdbcTemplate.update("""
                        INSERT INTO loans (loan_code, member_id, borrowed_at, due_date, status)
                        VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY), 'ACTIVE')
                        """,
                loanCodeFixture, memberId);
        return jdbcTemplate.queryForObject("SELECT id FROM loans WHERE loan_code = ?", Integer.class, loanCodeFixture);
    }

    private MvcResult concurrentCreate(
            String token,
            String title,
            String isbn,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Book create concurrency fixture timed out");
        }
        return mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBookBody(title, isbn, false, 1)))
                .andReturn();
    }

    private MvcResult concurrentUpdate(
            String token,
            Integer bookId,
            String title,
            Long version,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Book update concurrency fixture timed out");
        }
        return mockMvc.perform(put("/api/v1/books/{id}", bookId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(updateBookBody(title, 2, version)))
                .andReturn();
    }

    private boolean hasUserBookCreatePermission() {
        Integer count = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FROM role_permissions rp
                        JOIN roles r ON r.id = rp.role_id
                        JOIN permissions p ON p.id = rp.permission_id
                        WHERE r.code = 'USER' AND p.code = 'book:create'
                        """,
                Integer.class);
        return count != null && count > 0;
    }

    private void setUserBookCreatePermission(boolean assigned) {
        if (assigned) {
            jdbcTemplate.update("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
                    WHERE r.code = 'USER' AND p.code = 'book:create'
                      AND NOT EXISTS (
                          SELECT 1 FROM role_permissions existing
                          WHERE existing.role_id = r.id AND existing.permission_id = p.id
                      )
                    """);
        } else {
            jdbcTemplate.update("""
                    DELETE rp FROM role_permissions rp
                    JOIN roles r ON r.id = rp.role_id
                    JOIN permissions p ON p.id = rp.permission_id
                    WHERE r.code = 'USER' AND p.code = 'book:create'
                    """);
        }
    }

}
