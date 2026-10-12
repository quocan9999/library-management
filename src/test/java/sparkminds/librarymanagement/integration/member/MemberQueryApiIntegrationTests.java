package sparkminds.librarymanagement.integration.member;

import com.jayway.jsonpath.JsonPath;
import liquibase.integration.spring.SpringLiquibase;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.context.transaction.AfterTransaction;
import org.springframework.test.context.transaction.BeforeTransaction;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
@Transactional
class MemberQueryApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private SpringLiquibase springLiquibase;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    private Map<String, Long> beforeCounts;
    private LocalDateTime fixtureStartedAt;
    private final Set<RefreshTokenFixture> issuedRefreshFixtures = new HashSet<>();

    @BeforeTransaction
    void captureMemberDatabaseStateBeforeFixtureTransaction() {
        assertThat(jdbcTemplate.queryForObject("SELECT DATABASE()", String.class))
                .isEqualTo("library_management_member");
        beforeCounts = tableCounts();
        fixtureStartedAt = LocalDateTime.now().minusSeconds(2);
        issuedRefreshFixtures.clear();
    }

    @AfterTransaction
    void verifyDatabaseFixturesWereRolledBack() {
        for (RefreshTokenFixture fixture : issuedRefreshFixtures) {
            jdbcTemplate.update("DELETE FROM refresh_tokens WHERE id = ? AND account_id = ? AND jti = ?",
                    fixture.id(), fixture.accountId(), fixture.jti());
        }
        assertThat(tableCounts()).isEqualTo(beforeCounts);
    }

    @Test
    void integrationContextUsesOnlyTheAuthorizedMemberDatabaseAndLocalSeedContext() {
        assertThat(datasourceUrl).isEqualTo("jdbc:mysql://localhost:3307/library_management_member");
        assertThat(jdbcTemplate.queryForObject("SELECT DATABASE()", String.class))
                .isEqualTo("library_management_member");
        assertThat(springLiquibase.getContexts()).isEqualTo("local");
    }

    @Test
    void memberListRequiresAuthenticationAndIsAvailableToAnAccountWithEffectiveReadPermission() throws Exception {
        mockMvc.perform(get("/api/v1/members"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
        mockMvc.perform(get("/api/v1/members/1"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/members/1/loan-history"))
                .andExpect(status().isUnauthorized());

        list(login("superadmin", "superadmin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("MEMBER_LIST_SUCCESS"));
    }

    @Test
    void migrationAddsPhoneUniquenessVersionAndAdminOnlyStatusPermission() {
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'members'
                  AND column_name = 'version' AND data_type = 'bigint'
                  AND is_nullable = 'NO' AND column_default = '0'
                """, Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = 'members'
                  AND index_name = 'uk_members_phone' AND column_name = 'phone' AND non_unique = 0
                """, Integer.class)).isEqualTo(1);
        assertThat(permissionLinkCount("ROLE_ADMIN", "member:status:update")).isEqualTo(1);
        assertThat(permissionLinkCount("ROLE_USER", "member:status:update")).isZero();
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM DATABASECHANGELOG
                WHERE ID IN ('026-member-phone-unique', '027-member-version', '028-seed-member-status-permission')
                """, Integer.class)).isEqualTo(3);
    }

    @Test
    void mergedRoleApiStillRejectsGrantingStatusPermissionToUser() throws Exception {
        String superAdminToken = login("superadmin", "superadmin");
        long beforeVersion = jdbcTemplate.queryForObject(
                "SELECT version FROM roles WHERE code = 'ROLE_USER'", Long.class);
        String body = "{\"expectedVersion\":" + beforeVersion
                + ",\"addPermissions\":[\"member:status:update\"],\"removePermissions\":[]}";

        MvcResult result = mockMvc.perform(patch("/api/v1/roles/ROLE_USER/permissions")
                        .header("Authorization", "Bearer " + superAdminToken)
                        .contentType(APPLICATION_JSON)
                        .content(body))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(403);
        assertThat(JsonPath.<String>read(result.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("PERMISSION_DENIED");
        assertThat(permissionLinkCount("ROLE_USER", "member:status:update")).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT version FROM roles WHERE code = 'ROLE_USER'", Long.class)).isEqualTo(beforeVersion);
    }

    @Test
    void currentDatabasePermissionsAllowUserReadAndRevokeAdminReadWithoutRoleChecks() throws Exception {
        String userToken = login("user", "user");
        String adminToken = login("admin", "admin");

        setPermission("ROLE_USER", "member:read", false);
        list(userToken).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

        setPermission("ROLE_USER", "member:read", true);
        list(userToken).andExpect(status().isOk());

        setPermission("ROLE_ADMIN", "member:read", false);
        list(adminToken).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

        list(login("superadmin", "superadmin")).andExpect(status().isOk());
    }

    @Test
    void listSearchCombinesFiltersPagesStablyAndIncludesDisabledUnverifiedMembers() throws Exception {
        String token = login("admin", "admin");
        LocalDateTime firstCreated = LocalDateTime.of(2025, 1, 1, 8, 0);
        MemberFixture special = createMember("M000123", "Nguyễn Đắc", "0388919210",
                LocalDate.of(1990, 2, 3), false, true, firstCreated);
        List<Integer> fixtureIdsByCreation = new java.util.ArrayList<>();
        fixtureIdsByCreation.add(special.memberId());
        for (int index = 1; index < 12; index++) {
            MemberFixture fixture = createMember("MMV8-PAGE-" + index, "Other Member " + index,
                    "03770000" + String.format("%02d", index),
                    LocalDate.of(1990, 2, 3).plusDays(index), true, index != 5,
                    firstCreated.plusDays(index));
            fixtureIdsByCreation.add(fixture.memberId());
        }

        MvcResult page0 = list(token).andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(page0), "$.data.size")).isEqualTo(10);
        assertThat(JsonPath.<Integer>read(body(page0), "$.data.totalElements")).isEqualTo(12);
        assertThat(JsonPath.<Integer>read(body(page0), "$.data.totalPages")).isEqualTo(2);
        assertThat(JsonPath.<Boolean>read(body(page0), "$.data.first")).isTrue();
        assertThat(JsonPath.<Boolean>read(body(page0), "$.data.last")).isFalse();

        MvcResult page1 = list(token, "page", "1").andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(page1), "$.data.content.length()")).isEqualTo(2);
        List<Integer> ids0 = JsonPath.read(body(page0), "$.data.content[*].id");
        List<Integer> ids1 = JsonPath.read(body(page1), "$.data.content[*].id");
        assertThat(ids0).doesNotContainAnyElementsOf(ids1);
        assertThat(ids0.get(0)).isEqualTo(fixtureIdsByCreation.get(11));
        assertThat(ids0.get(9)).isEqualTo(fixtureIdsByCreation.get(2));
        assertThat(ids1).containsExactly(fixtureIdsByCreation.get(1), special.memberId());

        assertThat(JsonPath.<Integer>read(body(list(token, "fullName", "Nguyen")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<String>read(body(list(token, "fullName", "Dac")
                        .andExpect(status().isOk()).andReturn()), "$.data.content[0].memberCode"))
                .isEqualTo("M000123");
        assertThat(JsonPath.<Integer>read(body(list(token, "memberCode", "123")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(list(token, "email", special.email().substring(5, 11))
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(list(token, "phone", "0388.919.210")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(list(token, "birthFrom", "1990-02-03", "birthTo", "1990-02-03")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(list(token, "birthFrom", "1990-02-03")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(12);
        assertThat(JsonPath.<Integer>read(body(list(token, "birthTo", "1990-02-03")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(list(token, "emailVerified", "false", "enabled", "true")
                        .andExpect(status().isOk()).andReturn()), "$.data.content[0].id"))
                .isEqualTo(special.memberId());
        assertThat(JsonPath.<Integer>read(body(list(token,
                        "fullName", "Nguyen", "email", special.email().substring(5, 11),
                        "phone", "0388.919.210", "birthFrom", "1990-02-03", "birthTo", "1990-02-03",
                        "emailVerified", "false", "enabled", "true")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(list(token, "enabled", "false")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
    }

    @Test
    void bookAndStatusUseOneMatchingLoanItemAndHistoryPagesLoanItemsWithSnapshotFees() throws Exception {
        String token = login("admin", "admin");
        MemberFixture member = createMember("MMV8-HISTORY", "Đắc History", null,
                LocalDate.of(1988, 5, 6), true, true, LocalDateTime.of(2025, 1, 1, 8, 0));
        LocalDateTime[] borrowedAt = {
                LocalDateTime.of(2026, 10, 1, 9, 0),
                LocalDateTime.of(2026, 10, 2, 9, 0),
                LocalDateTime.of(2026, 10, 3, 9, 0)
        };
        String[] loanStatuses = {"PARTIALLY_RETURNED", "ACTIVE", "ACTIVE"};
        int itemCount = 0;
        for (int loanIndex = 0; loanIndex < 3; loanIndex++) {
            int loanId = createLoan(member.memberId(), "MMV8-LOAN-" + loanIndex,
                    borrowedAt[loanIndex], loanStatuses[loanIndex]);
            int countForLoan = loanIndex == 0 ? 2 : 5;
            for (int itemIndex = 0; itemIndex < countForLoan; itemIndex++) {
                int globalIndex = itemCount++;
                String title = globalIndex == 0 ? "Đắc Atlas" : "Volume " + globalIndex;
                String bookCode = "MMV8-BOOK-" + globalIndex;
                int bookId = createBook(bookCode, title, globalIndex == 0 ? null : "ISBN" + globalIndex);
                String itemStatus = globalIndex == 0 ? "RETURNED" : "BORROWED";
                BigDecimal borrowFee = globalIndex == 0 ? new BigDecimal("12.34")
                        : new BigDecimal("10." + String.format("%02d", globalIndex));
                BigDecimal lateFee = globalIndex == 0 ? new BigDecimal("3.21")
                        : new BigDecimal("0." + String.format("%02d", globalIndex));
                createLoanItem(loanId, bookId, itemStatus, borrowFee,
                        new BigDecimal("1.25"), lateFee,
                        "RETURNED".equals(itemStatus) ? borrowedAt[loanIndex].plusDays(3) : null);
            }
        }
        int inventoryBeforeReads = jdbcTemplate.queryForObject(
                "SELECT SUM(available_quantity) FROM books WHERE book_code LIKE 'MMV8-BOOK-%'", Integer.class);
        int itemCountBeforeReads = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM loan_items WHERE loan_id IN "
                        + "(SELECT id FROM loans WHERE loan_code LIKE 'MMV8-LOAN-%')", Integer.class);

        MvcResult combinedMismatch = list(token, "book", "Dac", "borrowStatus", "BORROWED")
                .andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(combinedMismatch), "$.data.totalElements")).isZero();
        assertThat(JsonPath.<Integer>read(body(list(token, "book", "Dac", "borrowStatus", "RETURNED")
                        .andExpect(status().isOk()).andReturn()), "$.data.content[0].id"))
                .isEqualTo(member.memberId());
        assertThat(JsonPath.<Integer>read(body(list(token, "borrowStatus", "BORROWED")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(list(token, "book", "Volume")
                        .andExpect(status().isOk()).andReturn()), "$.data.totalElements")).isEqualTo(1);

        MvcResult page0 = history(token, member.memberId(), "status", "ALL", "size", "10")
                .andExpect(status().isOk()).andReturn();
        MvcResult page1 = history(token, member.memberId(), "status", "ALL", "page", "1", "size", "10")
                .andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(page0), "$.data.totalElements")).isEqualTo(12);
        assertThat(JsonPath.<Integer>read(body(page0), "$.data.content.length()")).isEqualTo(10);
        assertThat(JsonPath.<Integer>read(body(page1), "$.data.content.length()")).isEqualTo(2);
        List<Integer> firstPageItems = JsonPath.read(body(page0), "$.data.content[*].loanItemId");
        List<Integer> secondPageItems = JsonPath.read(body(page1), "$.data.content[*].loanItemId");
        List<String> firstPageLoanCodes = JsonPath.read(body(page0), "$.data.content[*].loanCode");
        assertThat(firstPageItems).doesNotContainAnyElementsOf(secondPageItems);
        assertThat(firstPageItems).hasSize(10);
        assertThat(firstPageLoanCodes.stream().filter("MMV8-LOAN-2"::equals).count()).isEqualTo(5);
        assertThat(JsonPath.<String>read(body(page0), "$.data.content[0].loanCode")).isEqualTo("MMV8-LOAN-2");

        MvcResult borrowed = history(token, member.memberId(), "status", "BORROWED")
                .andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(borrowed), "$.data.totalElements")).isEqualTo(11);
        assertThat(JsonPath.<String>read(body(borrowed), "$.data.content[0].itemStatus")).isEqualTo("BORROWED");
        MvcResult returned = history(token, member.memberId(), "status", "RETURNED")
                .andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(returned), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<String>read(body(returned), "$.data.content[0].isbn")).isNull();
        assertThat(JsonPath.<String>read(body(returned), "$.data.content[0].returnedAt")).isNotNull();
        assertThat(decimal(returned, "$.data.content[0].borrowFee")).isEqualTo(new BigDecimal("12.34"));
        assertThat(decimal(returned, "$.data.content[0].lateFeePerDay")).isEqualTo(new BigDecimal("1.25"));
        assertThat(decimal(returned, "$.data.content[0].lateFee")).isEqualTo(new BigDecimal("3.21"));
        assertThat(decimal(returned, "$.data.content[0].recordedTotalFee")).isEqualTo(new BigDecimal("15.55"));
        assertThat(JsonPath.<Integer>read(body(detail(token, member.memberId())
                        .andExpect(status().isOk()).andReturn()), "$.data.borrowedItemCount")).isEqualTo(11);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT SUM(available_quantity) FROM books WHERE book_code LIKE 'MMV8-BOOK-%'", Integer.class))
                .isEqualTo(inventoryBeforeReads);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM loan_items WHERE loan_id IN "
                        + "(SELECT id FROM loans WHERE loan_code LIKE 'MMV8-LOAN-%')", Integer.class))
                .isEqualTo(itemCountBeforeReads);
    }

    @Test
    void emptyHistoryNotFoundAndMalformedSearchParametersUseExpectedHttpStatuses() throws Exception {
        String token = login("admin", "admin");
        MemberFixture noHistory = createMember("MMV8-EMPTY", "Empty History", null,
                LocalDate.of(1980, 1, 1), true, true, LocalDateTime.of(2025, 1, 1, 8, 0));
        MvcResult empty = history(token, noHistory.memberId()).andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(empty), "$.data.totalElements")).isZero();
        assertThat(JsonPath.<Integer>read(body(empty), "$.data.content.length()")).isZero();

        detail(token, 99999999).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
        history(token, 99999999).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));

        List<String[]> invalidSearches = List.of(
                new String[]{"borrowStatus", "UNKNOWN"},
                new String[]{"birthFrom", "not-a-date"},
                new String[]{"birthFrom", "2020-02-01", "birthTo", "2020-01-01"},
                new String[]{"page", "-1"},
                new String[]{"page", "oops"},
                new String[]{"size", "11"},
                new String[]{"sort", "password,desc"},
                new String[]{"emailVerified", "yes"}
        );
        for (String[] parameters : invalidSearches) {
            MvcResult invalid = list(token, parameters).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_MEMBER_QUERY")).andReturn();
            assertThat(body(invalid)).doesNotContain("SQLException", "stackTrace", "password_hash");
        }
        history(token, noHistory.memberId(), "status", "INVALID")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_MEMBER_QUERY"));
        history(token, noHistory.memberId(), "size", "0")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_MEMBER_QUERY"));
    }

    @Test
    void patchUpdatesOnlyChangedProfileFieldsAndIncrementsVersionOnceWithoutChangingHistory() throws Exception {
        String token = login("superadmin", "superadmin");
        MemberFixture fixture = createMember("MMV8-P03-UPDATE", "Original Name", "0370000001",
                LocalDate.of(1990, 1, 1), true, true, LocalDateTime.now());
        int loanId = createLoan(fixture.memberId(), "MMV8-P03-LOAN",
                LocalDateTime.of(2026, 10, 1, 9, 0), "ACTIVE");
        int bookId = createBook("MMV8-P03-BOOK", "Profile history fixture", null);
        createLoanItem(loanId, bookId, "BORROWED", new BigDecimal("12.34"), new BigDecimal("1.25"),
                BigDecimal.ZERO, null);
        MvcResult historyBefore = history(token, fixture.memberId()).andExpect(status().isOk()).andReturn();
        Integer originalLoanItemId = JsonPath.read(body(historyBefore), "$.data.content[0].loanItemId");

        MvcResult result = patchProfile(token, fixture.memberId(), """
                {"version":0,"fullName":"  Updated Member  ","dateOfBirth":"%s","address":"  Updated address  "}
                """.formatted(LocalDate.now().minusYears(16)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("MEMBER_PROFILE_UPDATED"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.fullName").value("Updated Member"))
                .andExpect(jsonPath("$.data.dateOfBirth").value(LocalDate.now().minusYears(16).toString()))
                .andExpect(jsonPath("$.data.address").value("Updated address"))
                .andExpect(jsonPath("$.data.phone").value("0370000001"))
                .andReturn();

        assertThat(JsonPath.<Number>read(body(result), "$.data.version").longValue()).isEqualTo(1L);
        assertThat(JsonPath.<Integer>read(body(detail(token, fixture.memberId())
                .andExpect(status().isOk()).andReturn()), "$.data.version")).isEqualTo(1);
        MvcResult historyResult = history(token, fixture.memberId())
                .andExpect(status().isOk()).andReturn();
        assertThat(JsonPath.<Integer>read(body(historyResult), "$.data.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(body(historyResult), "$.data.content[0].loanItemId"))
                .isEqualTo(originalLoanItemId);
        assertThat(decimal(historyResult, "$.data.content[0].borrowFee")).isEqualTo(new BigDecimal("12.34"));
        assertThat(jdbcTemplate.queryForObject("SELECT version FROM members WHERE id = ?", Long.class,
                fixture.memberId())).isEqualTo(1L);
    }

    @Test
    void patchNoOpPreservesVersionButStillRejectsAStaleClientVersion() throws Exception {
        String token = login("superadmin", "superadmin");
        MemberFixture fixture = createMember("MMV8-P03-NOOP", "Original Name", "0370000002",
                LocalDate.of(1990, 1, 1), true, true, LocalDateTime.now());

        patchProfile(token, fixture.memberId(), """
                {"version":0,"fullName":"   ","phone":"  ","address":null}
                """).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(0));

        patchProfile(token, fixture.memberId(), "{\"version\":1,\"address\":\"\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEMBER_VERSION_CONFLICT"));
        assertThat(jdbcTemplate.queryForObject("SELECT version FROM members WHERE id = ?", Long.class,
                fixture.memberId())).isZero();
    }

    @Test
    void patchUsesCurrentEffectivePermissionAndRejectsUnknownImmutableAndInvalidFields() throws Exception {
        MemberFixture fixture = createMember("MMV8-P03-GUARD", "Original Name", null,
                LocalDate.of(1990, 1, 1), true, true, LocalDateTime.now());
        patchProfile(null, fixture.memberId(), "{\"version\":0,\"fullName\":\"Denied\"}")
                .andExpect(status().isUnauthorized());

        String userToken = login("user", "user");
        patchProfile(userToken, fixture.memberId(), "{\"version\":0,\"fullName\":\"Denied\"}")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

        String token = login("superadmin", "superadmin");
        int adminPermissionBaseline = permissionLinkCount("ROLE_ADMIN", "member:update");
        try {
            setPermission("ROLE_ADMIN", "member:update", false);
            patchProfile(login("admin", "admin"), fixture.memberId(),
                    "{\"version\":0,\"fullName\":\"Admin Denied\"}")
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        } finally {
            setPermission("ROLE_ADMIN", "member:update", adminPermissionBaseline > 0);
        }

        patchProfile(token, fixture.memberId(), "{\"version\":0,\"enabled\":false}")
                .andExpect(status().isBadRequest());
        patchProfile(token, fixture.memberId(), "{\"version\":0,\"account\":{\"role\":\"ROLE_ADMIN\"}}")
                .andExpect(status().isBadRequest());
        patchProfile(token, fixture.memberId(), "{\"version\":0,\"fullName\":null,\"unknownField\":true}")
                .andExpect(status().isBadRequest());
        patchProfile(token, fixture.memberId(), "{\"fullName\":\"Missing version\"}")
                .andExpect(status().isUnprocessableEntity());

        patchProfile(token, fixture.memberId(), """
                {"version":0,"fullName":"Would partially save","dateOfBirth":"%s"}
                """.formatted(LocalDate.now().minusYears(16).plusDays(1)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MEMBER_PATCH_VALIDATION_ERROR"));
        patchProfile(token, fixture.memberId(), "{\"version\":0,\"phone\":\"0123.456.789\"}")
                .andExpect(status().isUnprocessableEntity());
        patchProfile(token, fixture.memberId(), "{\"version\":0,\"fullName\":\"%s\"}"
                        .formatted("x".repeat(151)))
                .andExpect(status().isUnprocessableEntity());
        patchProfile(token, fixture.memberId(), "{\"version\":0,\"address\":\"%s\"}"
                        .formatted("x".repeat(256)))
                .andExpect(status().isUnprocessableEntity());
        patchProfile(token, fixture.memberId(), "{\"version\":0,\"phone\":\"03AB123456\"}")
                .andExpect(status().isUnprocessableEntity());
        patchProfile(token, 99999999, "{\"version\":0,\"fullName\":\"Missing\"}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));

        assertThat(jdbcTemplate.queryForObject("SELECT version FROM members WHERE id = ?", Long.class,
                fixture.memberId())).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT full_name FROM members WHERE id = ?", String.class,
                fixture.memberId())).isEqualTo("Original Name");

        int userPermissionBaseline = permissionLinkCount("ROLE_USER", "member:update");
        try {
            setPermission("ROLE_USER", "member:update", true);
            patchProfile(userToken, fixture.memberId(), "{\"version\":0,\"fullName\":\"User Allowed\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.fullName").value("User Allowed"))
                    .andExpect(jsonPath("$.data.version").value(1));
        } finally {
            setPermission("ROLE_USER", "member:update", userPermissionBaseline > 0);
        }
    }

    @Test
    void patchNormalizesPhoneAndRejectsDuplicatesEvenWhenTheOtherAccountIsDisabled() throws Exception {
        String token = login("superadmin", "superadmin");
        MemberFixture target = createMember("MMV8-P03-PHONE-A", "Target", "0370000003",
                LocalDate.of(1990, 1, 1), true, true, LocalDateTime.now());
        createMember("MMV8-P03-PHONE-B", "Disabled duplicate", "0370000004",
                LocalDate.of(1990, 1, 1), true, false, LocalDateTime.now());

        patchProfile(token, target.memberId(), "{\"version\":0,\"phone\":\" 0388.919.210 \"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone").value("0388919210"))
                .andExpect(jsonPath("$.data.version").value(1));
        patchProfile(token, target.memberId(), "{\"version\":1,\"phone\":\"0370 000 004\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEMBER_PHONE_DUPLICATED"));
        assertThat(jdbcTemplate.queryForObject("SELECT phone FROM members WHERE id = ?", String.class,
                target.memberId())).isEqualTo("0388919210");
    }

    @Test
    void concurrentSameVersionHttpPatchesHaveOneWinnerAndOneConflict() throws Exception {
        String firstAdmin = login("admin", "admin");
        String secondAdmin = login("admin", "admin");
        TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
        requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        MemberFixture fixture = requiresNew.execute(status -> createMember(
                "MMV8-P03-RACE-" + UUID.randomUUID().toString().substring(0, 8), "Concurrent Original",
                "0370000005", LocalDate.of(1990, 1, 1), true, true, LocalDateTime.now()));
        assertThat(fixture).isNotNull();

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentPatch(ready, start, firstAdmin,
                    fixture.memberId(), "First Winner"));
            Future<MvcResult> second = executor.submit(() -> concurrentPatch(ready, start, secondAdmin,
                    fixture.memberId(), "Second Winner"));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            MvcResult firstResult = first.get(20, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(20, TimeUnit.SECONDS);

            assertThat(List.of(firstResult.getResponse().getStatus(), secondResult.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(JsonPath.<String>read(
                    firstResult.getResponse().getStatus() == 409
                            ? body(firstResult) : body(secondResult), "$.code"))
                    .isEqualTo("MEMBER_VERSION_CONFLICT");
            Long committedVersion = requiresNew.execute(status -> jdbcTemplate.queryForObject(
                    "SELECT version FROM members WHERE id = ?", Long.class, fixture.memberId()));
            assertThat(committedVersion).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
            requiresNew.executeWithoutResult(status -> deleteCommittedFixture(fixture.memberId()));
        }
    }

    @Test
    void concurrentHttpUpdatesCannotAssignOnePhoneToTwoMembers() throws Exception {
        String firstAdmin = login("admin", "admin");
        String secondAdmin = login("admin", "admin");
        TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
        requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        List<MemberFixture> fixtures = requiresNew.execute(status -> List.of(
                createMember("MMV8-P03-PHONE-RACE-A-" + UUID.randomUUID().toString().substring(0, 6),
                        "Phone Race A", "0370000011", LocalDate.of(1990, 1, 1), true, true, LocalDateTime.now()),
                createMember("MMV8-P03-PHONE-RACE-B-" + UUID.randomUUID().toString().substring(0, 6),
                        "Phone Race B", "0370000012", LocalDate.of(1990, 1, 1), true, true, LocalDateTime.now())
        ));
        assertThat(fixtures).hasSize(2);

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentPhonePatch(
                    ready, start, firstAdmin, fixtures.get(0).memberId()));
            Future<MvcResult> second = executor.submit(() -> concurrentPhonePatch(
                    ready, start, secondAdmin, fixtures.get(1).memberId()));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            MvcResult firstResult = first.get(20, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(20, TimeUnit.SECONDS);

            assertThat(List.of(firstResult.getResponse().getStatus(), secondResult.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200, 409);
            String duplicateResponse = firstResult.getResponse().getStatus() == 409
                    ? body(firstResult) : body(secondResult);
            assertThat(JsonPath.<String>read(duplicateResponse, "$.code")).isEqualTo("MEMBER_PHONE_DUPLICATED");
            Integer assignments = requiresNew.execute(status -> jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM members WHERE phone = '0388919222'", Integer.class));
            assertThat(assignments).isEqualTo(1);
        } finally {
            executor.shutdownNow();
            requiresNew.executeWithoutResult(status -> {
                for (MemberFixture fixture : fixtures) deleteCommittedFixture(fixture.memberId());
            });
        }
    }

    private MvcResult concurrentPatch(
            CountDownLatch ready,
            CountDownLatch start,
            String token,
            Integer memberId,
            String fullName
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent patch start timed out.");
        return patchProfile(token, memberId, "{\"version\":0,\"fullName\":\"%s\"}".formatted(fullName))
                .andReturn();
    }

    private MvcResult concurrentPhonePatch(
            CountDownLatch ready,
            CountDownLatch start,
            String token,
            Integer memberId
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent phone start timed out.");
        return patchProfile(token, memberId, "{\"version\":0,\"phone\":\"0388.919.222\"}").andReturn();
    }

    private void deleteCommittedFixture(Integer memberId) {
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT account_id FROM members WHERE id = ?", Integer.class, memberId);
        jdbcTemplate.update("DELETE FROM members WHERE id = ?", memberId);
        jdbcTemplate.update("DELETE FROM accounts WHERE id = ?", accountId);
    }

    private ResultActions patchProfile(String token, Integer memberId, String body) throws Exception {
        MockHttpServletRequestBuilder request = patch("/api/v1/members/{id}", memberId)
                .contentType(APPLICATION_JSON)
                .content(body);
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mockMvc.perform(request);
    }

    private String login(String identifier, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + identifier + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        recordIssuedRefreshFixture(identifier);
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
    }

    private void recordIssuedRefreshFixture(String identifier) {
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT id FROM accounts WHERE username = ?", Integer.class, identifier);
        List<RefreshTokenFixture> rows = jdbcTemplate.query("""
                        SELECT id, account_id, jti FROM refresh_tokens
                        WHERE account_id = ? AND created_at >= ?
                        ORDER BY id DESC LIMIT 1
                        """,
                (result, rowNumber) -> new RefreshTokenFixture(
                        result.getInt("id"), result.getInt("account_id"), result.getString("jti")),
                accountId, fixtureStartedAt);
        if (!rows.isEmpty()) issuedRefreshFixtures.add(rows.get(0));
    }

    private ResultActions list(String token, String... parameters) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/members");
        for (int index = 0; index < parameters.length; index += 2) {
            request.param(parameters[index], parameters[index + 1]);
        }
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private ResultActions detail(String token, Integer id) throws Exception {
        return mockMvc.perform(get("/api/v1/members/{id}", id)
                .header("Authorization", "Bearer " + token));
    }

    private ResultActions history(String token, Integer id, String... parameters) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/members/{id}/loan-history", id);
        for (int index = 0; index < parameters.length; index += 2) {
            request.param(parameters[index], parameters[index + 1]);
        }
        return mockMvc.perform(request.header("Authorization", "Bearer " + token));
    }

    private MemberFixture createMember(
            String memberCode,
            String fullName,
            String phone,
            LocalDate dateOfBirth,
            boolean emailVerified,
            boolean enabled,
            LocalDateTime createdAt
    ) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String username = "mmv8" + suffix;
        String email = "mmv8." + suffix + "@example.test";
        jdbcTemplate.update("""
                INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                SELECT ?, ?, 'fixture-password-hash', id, ?, ?
                FROM roles WHERE code = 'ROLE_USER'
                """, username, email, emailVerified, enabled);
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT id FROM accounts WHERE username = ?", Integer.class, username);
        jdbcTemplate.update("""
                INSERT INTO members (account_id, member_code, full_name, date_of_birth, phone, address,
                                     created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'Fixture address', ?, ?)
                """, accountId, memberCode, fullName, dateOfBirth, phone, createdAt, createdAt);
        Integer memberId = jdbcTemplate.queryForObject(
                "SELECT id FROM members WHERE member_code = ?", Integer.class, memberCode);
        return new MemberFixture(memberId, email);
    }

    private int createBook(String code, String title, String isbn) {
        jdbcTemplate.update("""
                INSERT INTO books (book_code, isbn, title, author, total_quantity, available_quantity,
                                   borrow_fee, late_fee_per_day)
                VALUES (?, ?, ?, 'Fixture Author', 5, 5, 25.00, 1.50)
                """, code, isbn, title);
        return jdbcTemplate.queryForObject("SELECT id FROM books WHERE book_code = ?", Integer.class, code);
    }

    private int createLoan(Integer memberId, String code, LocalDateTime borrowedAt, String status) {
        jdbcTemplate.update("""
                INSERT INTO loans (loan_code, member_id, borrowed_at, due_date, status)
                VALUES (?, ?, ?, ?, ?)
                """, code, memberId, borrowedAt, borrowedAt.toLocalDate().plusDays(14), status);
        return jdbcTemplate.queryForObject("SELECT id FROM loans WHERE loan_code = ?", Integer.class, code);
    }

    private void createLoanItem(
            int loanId,
            int bookId,
            String status,
            BigDecimal borrowFee,
            BigDecimal lateFeePerDay,
            BigDecimal lateFee,
            LocalDateTime returnedAt
    ) {
        jdbcTemplate.update("""
                INSERT INTO loan_items (loan_id, book_id, status, borrow_fee, late_fee_per_day, late_fee, returned_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, loanId, bookId, status, borrowFee, lateFeePerDay, lateFee, returnedAt);
    }

    private void setPermission(String roleCode, String permissionCode, boolean assigned) {
        if (assigned) {
            jdbcTemplate.update("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
                    WHERE r.code = ? AND p.code = ?
                      AND NOT EXISTS (SELECT 1 FROM role_permissions existing
                                      WHERE existing.role_id = r.id AND existing.permission_id = p.id)
                    """, roleCode, permissionCode);
        } else {
            jdbcTemplate.update("""
                    DELETE rp FROM role_permissions rp
                    JOIN roles r ON r.id = rp.role_id
                    JOIN permissions p ON p.id = rp.permission_id
                    WHERE r.code = ? AND p.code = ?
                    """, roleCode, permissionCode);
        }
        // Xóa persistence context trong test để mô phỏng request kế tiếp nạp quyền hiện hành từ DB.
        entityManager.clear();
    }

    private int permissionLinkCount(String roleCode, String permissionCode) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE r.code = ? AND p.code = ?
                """, Integer.class, roleCode, permissionCode);
    }

    private Map<String, Long> tableCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : List.of("accounts", "members", "books", "loans", "loan_items",
                "refresh_tokens", "role_permissions")) {
            counts.put(table, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        }
        return counts;
    }

    private static String body(MvcResult result) {
        try {
            return result.getResponse().getContentAsString();
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private static BigDecimal decimal(MvcResult result, String path) {
        return new BigDecimal(JsonPath.<Number>read(body(result), path).toString());
    }

    private record MemberFixture(Integer memberId, String email) {
    }

    private record RefreshTokenFixture(Integer id, Integer accountId, String jti) {
    }
}
