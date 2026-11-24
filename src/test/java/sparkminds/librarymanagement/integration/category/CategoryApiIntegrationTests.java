package sparkminds.librarymanagement.integration.category;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test cho API quản lý danh mục sách: CRUD, phân quyền, version conflict
 * và các ràng buộc nghiệp vụ (trùng tên, còn sách tham chiếu).
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class CategoryApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String fixtureSuffix;
    private String categoryNameFixture;
    private String userEmailFixture;
    private String userUsernameFixture;
    private final List<Integer> refreshTokenIds = new ArrayList<>();

    @BeforeEach
    void verifyTestDatabaseAndPrepareFixture() {
        // Guard dữ liệu: test chỉ được chạy trên database có mẫu tên đúng quy ước.
        String database = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        assertThat(database).matches("library_management(?:_[A-Za-z0-9]+)*_test");
        fixtureSuffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        categoryNameFixture = "Category " + fixtureSuffix;
        userEmailFixture = "category-user-" + fixtureSuffix + "@example.test";
        userUsernameFixture = "catu" + fixtureSuffix.substring(0, 10);
        refreshTokenIds.clear();
    }

    @AfterEach
    void cleanOnlyFixturesCreatedByThisTest() {
        // Xóa sách gán danh mục fixture trước (bảng nối CASCADE theo book_id).
        jdbcTemplate.update("DELETE FROM books WHERE author = ?", "Category Book " + fixtureSuffix);
        jdbcTemplate.update("DELETE FROM categories WHERE name LIKE ?", categoryNameFixture + "%");
        for (Integer refreshTokenId : refreshTokenIds) {
            jdbcTemplate.update("DELETE FROM refresh_tokens WHERE id = ?", refreshTokenId);
        }
        jdbcTemplate.update("DELETE FROM refresh_tokens WHERE account_id = (SELECT id FROM accounts WHERE email = ?)",
                userEmailFixture);
        jdbcTemplate.update("DELETE FROM accounts WHERE email = ?", userEmailFixture);
    }

    @Test
    void categoryLifecycleCreateListUpdateDelete() throws Exception {
        String token = loginAsSuperAdmin();
        Integer id = createCategory(token, categoryNameFixture);

        // List có tìm thấy danh mục vừa tạo.
        mockMvc.perform(get("/api/v1/categories").param("q", categoryNameFixture)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].name").value(categoryNameFixture))
                .andExpect(jsonPath("$.data.content[0].bookCount").value(0));

        // Cập nhật tên và mô tả.
        mockMvc.perform(put("/api/v1/categories/{id}", id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"" + categoryNameFixture + " v2\",\"description\":\"updated\",\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(categoryNameFixture + " v2"))
                .andExpect(jsonPath("$.data.version").value(1));

        // Xóa danh mục chưa gán sách.
        mockMvc.perform(delete("/api/v1/categories/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void duplicateNameReturns409() throws Exception {
        String token = loginAsSuperAdmin();
        createCategory(token, categoryNameFixture);
        mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"" + categoryNameFixture.toUpperCase() + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATEGORY_NAME_DUPLICATED"));
    }

    @Test
    void staleVersionReturns409() throws Exception {
        String token = loginAsSuperAdmin();
        Integer id = createCategory(token, categoryNameFixture);
        mockMvc.perform(put("/api/v1/categories/{id}", id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"" + categoryNameFixture + " stale\",\"version\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATEGORY_VERSION_CONFLICT"));
    }

    @Test
    void deleteCategoryWithBooksReturns409() throws Exception {
        String token = loginAsSuperAdmin();
        Integer categoryId = createCategory(token, categoryNameFixture);
        Integer bookId = createBookWithCategories(token, categoryId);

        mockMvc.perform(delete("/api/v1/categories/{id}", categoryId).header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATEGORY_HAS_BOOKS"));

        Integer bookCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM book_categories WHERE category_id = ?", Integer.class, categoryId);
        assertThat(bookCount).isEqualTo(1);
        assertThat(bookId).isPositive();
    }

    @Test
    void bookCreateWithCategoriesReturnsCategoriesInDetail() throws Exception {
        String token = loginAsSuperAdmin();
        Integer categoryId = createCategory(token, categoryNameFixture);
        MvcResult result = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(bookBody("Category Book " + fixtureSuffix, "[" + categoryId + "]")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.categories[0].id").value(categoryId))
                .andExpect(jsonPath("$.data.categories[0].name").value(categoryNameFixture))
                .andReturn();
        Integer bookId = JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
        assertThat(bookId).isPositive();
    }

    @Test
    void bookCreateWithUnknownCategoryIdReturns422() throws Exception {
        String token = loginAsSuperAdmin();
        mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(bookBody("Category Book " + fixtureSuffix, "[999999]")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("CATEGORY_VALIDATION_ERROR"));
    }

    @Test
    void userCanReadOptionsButNotAdminList() throws Exception {
        String token = loginAsUser();
        // USER có category:read → được gọi options để lọc catalog.
        mockMvc.perform(get("/api/v1/categories/options").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        // USER không được phép trang quản trị danh mục.
        mockMvc.perform(get("/api/v1/categories").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void catalogFilterByCategoryIdReturnsMatchingBooksAndCategories() throws Exception {
        String adminToken = loginAsSuperAdmin();
        Integer categoryA = createCategory(adminToken, categoryNameFixture + " A");
        Integer categoryB = createCategory(adminToken, categoryNameFixture + " B");
        Integer bookA = createBookWithCategories(adminToken, "Catalog Book A " + fixtureSuffix, categoryA);
        createBookWithCategories(adminToken, "Catalog Book B " + fixtureSuffix, categoryB);

        String userToken = loginAsUser();
        mockMvc.perform(get("/api/v1/catalog/books")
                        .param("categoryId", String.valueOf(categoryA))
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(bookA))
                .andExpect(jsonPath("$.data.content[0].categories[0].id").value(categoryA))
                .andExpect(jsonPath("$.data.content[0].categories[0].name").value(categoryNameFixture + " A"));

        mockMvc.perform(get("/api/v1/catalog/books/{bookId}", bookA)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.categories[0].id").value(categoryA));
    }

    @Test
    void catalogFilterByInvalidCategoryIdReturns400() throws Exception {
        String userToken = loginAsUser();
        for (String invalidId : List.of("abc", "0", "-1")) {
            mockMvc.perform(get("/api/v1/catalog/books")
                            .param("categoryId", invalidId)
                            .header("Authorization", "Bearer " + userToken))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_BOOK_QUERY"));
        }
    }

    @Test
    void catalogFilterByEmptyCategoryReturnsEmptyPage() throws Exception {
        String adminToken = loginAsSuperAdmin();
        Integer emptyCategory = createCategory(adminToken, categoryNameFixture + " Empty");

        String userToken = loginAsUser();
        mockMvc.perform(get("/api/v1/catalog/books")
                        .param("categoryId", String.valueOf(emptyCategory))
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0))
                .andExpect(jsonPath("$.data.content").isEmpty());
    }

    private String loginAsSuperAdmin() throws Exception {
        return login("admin", "admin");
    }

    private String loginAsUser() throws Exception {
        jdbcTemplate.update("""
                        INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                        SELECT ?, ?, ?, id, true, true FROM roles WHERE code = 'USER'
                        """,
                userUsernameFixture, userEmailFixture, passwordEncoder.encode("FixtureCat1!"));
        return login(userUsernameFixture, "FixtureCat1!");
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

    private Integer createCategory(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value(name))
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
    }

    private Integer createBookWithCategories(String token, Integer categoryId) throws Exception {
        return createBookWithCategories(token, "Category Book " + fixtureSuffix, categoryId);
    }

    private Integer createBookWithCategories(String token, String title, Integer categoryId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(bookBody(title, "[" + categoryId + "]")))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
    }

    private String bookBody(String title, String categoryIdsJson) {
        return """
                {"title":"%s","author":"Category Book %s","isbn":null,"totalQuantity":1,
                 "borrowFee":0,"price":0,"lateFeePerDay":0,"categoryIds":%s,"confirmSimilar":true}
                """.formatted(title, fixtureSuffix, categoryIdsJson);
    }
}
