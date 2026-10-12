package sparkminds.librarymanagement.integration.member;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.mail.MailSendException;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.service.RefreshCookieFactory;
import sparkminds.librarymanagement.auth.service.VerificationTokenService;
import sparkminds.librarymanagement.member.repository.MemberLoanHistoryRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Kiểm tra vòng đời Admin Create qua HTTP và dọn đúng các fixture đã tạo. */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class MemberAdminLifecycleIntegrationTests {

    private static final String INITIAL_PASSWORD = "MemberCreate1!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @MockitoBean
    private JavaMailSender javaMailSender;

    @MockitoSpyBean
    private VerificationTokenService verificationTokenService;

    @MockitoSpyBean
    private MemberLoanHistoryRepository memberLoanHistoryRepository;

    private Map<String, Long> beforeCounts;
    private final List<String> createdEmails = new ArrayList<>();
    private final List<RefreshFixture> adminRefreshFixtures = new ArrayList<>();

    @BeforeEach
    void verifyConfiguredTestDatabaseAndCaptureBaseline() {
        String database = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        assertThat(database).matches("library_management(?:_[A-Za-z0-9]+)*_test");
        assertThat(datasourceUrl).endsWith("/" + database);
        beforeCounts = counts();
        createdEmails.clear();
        adminRefreshFixtures.clear();
    }

    @AfterEach
    void cleanOnlyFixturesCreatedByThisTest() {
        for (String email : createdEmails) {
            List<Integer> accountIds = jdbcTemplate.queryForList(
                    "SELECT id FROM accounts WHERE email = ?", Integer.class, email);
            for (Integer accountId : accountIds) {
                List<Integer> memberIds = jdbcTemplate.queryForList(
                        "SELECT id FROM members WHERE account_id = ?", Integer.class, accountId);
                for (Integer memberId : memberIds) {
                    jdbcTemplate.update("DELETE li FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.member_id = ?", memberId);
                    jdbcTemplate.update("DELETE FROM loans WHERE member_id = ?", memberId);
                }
                jdbcTemplate.update("DELETE FROM members WHERE account_id = ?", accountId);
                jdbcTemplate.update("DELETE FROM accounts WHERE id = ?", accountId);
            }
        }
        for (RefreshFixture fixture : adminRefreshFixtures) {
            jdbcTemplate.update("DELETE FROM refresh_tokens WHERE id = ? AND account_id = ? AND jti = ?",
                    fixture.id(), fixture.accountId(), fixture.jti());
        }
        assertThat(counts()).isEqualTo(beforeCounts);
    }

    @Test
    void adminCreateCommitsUserMemberAndHashedVerificationTokenBeforeSendingMail() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String email = "mmv8-create-" + suffix + "@example.test";
        createdEmails.add(email);
        String token = loginAsSuperAdmin();

        MvcResult response = mockMvc.perform(post("/api/v1/members")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"email":"  %s  ","password":"%s","fullName":"  Test Member  ",
                                 "dateOfBirth":"1990-01-02","phone":" 0388.919.210 ","address":"  Test Address  "}
                                """.formatted(email.toUpperCase(java.util.Locale.ROOT), INITIAL_PASSWORD)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("MEMBER_CREATED"))
                .andExpect(jsonPath("$.data.email").value(email))
                .andExpect(jsonPath("$.data.fullName").value("Test Member"))
                .andExpect(jsonPath("$.data.phone").value("0388919210"))
                .andExpect(jsonPath("$.data.address").value("Test Address"))
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.emailVerified").value(false))
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.verificationToken").doesNotExist())
                .andReturn();

        assertThat(response.getResponse().getContentAsString()).doesNotContain(INITIAL_PASSWORD, "passwordHash", "tokenHash");
        Integer accountId = jdbcTemplate.queryForObject("SELECT id FROM accounts WHERE email = ?", Integer.class, email);
        assertThat(jdbcTemplate.queryForObject("SELECT enabled FROM accounts WHERE id = ?", Boolean.class, accountId)).isTrue();
        Integer roleId = jdbcTemplate.queryForObject("SELECT role_id FROM accounts WHERE id = ?", Integer.class, accountId);
        assertThat(jdbcTemplate.queryForObject("SELECT code FROM roles WHERE id = ?", String.class, roleId))
                .isEqualTo("ROLE_USER");
        String passwordHash = jdbcTemplate.queryForObject("SELECT password_hash FROM accounts WHERE id = ?", String.class, accountId);
        assertThat(passwordHash).isNotEqualTo(INITIAL_PASSWORD);
        assertThat(passwordEncoder.matches(INITIAL_PASSWORD, passwordHash)).isTrue();

        Integer memberId = jdbcTemplate.queryForObject("SELECT id FROM members WHERE account_id = ?", Integer.class, accountId);
        assertThat(JsonPath.<String>read(response.getResponse().getContentAsString(), "$.data.memberCode"))
                .isEqualTo("M" + String.format(java.util.Locale.ROOT, "%06d", memberId));
        List<String> tokenHashes = jdbcTemplate.queryForList(
                "SELECT token_hash FROM email_verification_tokens WHERE account_id = ?", String.class, accountId);
        assertThat(tokenHashes).hasSize(1).allMatch(hash -> hash.matches("[a-f0-9]{64}"));

        var sentMail = forClass(SimpleMailMessage.class);
        verify(javaMailSender, times(1)).send(sentMail.capture());
        assertThat(sentMail.getValue().getTo()).containsExactly(email);
        assertThat(sentMail.getValue().getText()).contains("/verify-email?token=");
        Matcher tokenMatch = Pattern.compile("/verify-email\\?token=([A-Za-z0-9_-]+)")
                .matcher(sentMail.getValue().getText());
        assertThat(tokenMatch.find()).isTrue();
        String rawVerificationToken = tokenMatch.group(1);
        assertThat(tokenHashes.get(0)).isEqualTo(verificationTokenService.hash(rawVerificationToken));
        assertThat(tokenHashes.get(0)).isNotEqualTo(rawVerificationToken);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + email + "\",\"password\":\"" + INITIAL_PASSWORD + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + rawVerificationToken + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("EMAIL_VERIFIED"));
        assertThat(jdbcTemplate.queryForObject("SELECT enabled FROM accounts WHERE id = ?", Boolean.class, accountId))
                .isTrue();

        MvcResult memberLogin = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + email + "\",\"password\":\"" + INITIAL_PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        recordRefreshFixture(accountId);
        String memberAccessToken = JsonPath.read(memberLogin.getResponse().getContentAsString(), "$.data.accessToken");
        String refreshCookieValue = cookieValue(memberLogin.getResponse().getHeader("Set-Cookie"));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                        "/api/v1/members/{id}/account-status", memberId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("{\"expectedEnabled\":true,\"enabled\":false}"))
                .andExpect(status().isOk());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + memberAccessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"));
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + email + "\",\"password\":\"" + INITIAL_PASSWORD + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                        "/api/v1/members/{id}/account-status", memberId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("{\"expectedEnabled\":false,\"enabled\":true}"))
                .andExpect(status().isOk());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + memberAccessToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_TOKEN_INVALID"));
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new Cookie(RefreshCookieFactory.NAME, refreshCookieValue)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + email + "\",\"password\":\"" + INITIAL_PASSWORD + "\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void adminCreateRejectsDuplicateEmailPhoneAndInvalidProfileWithoutOrphanAccounts() throws Exception {
        String token = loginAsSuperAdmin();
        String email = fixtureEmail();
        String duplicatePhoneEmail = fixtureEmail();
        String invalidPasswordEmail = fixtureEmail();
        String missingPasswordEmail = fixtureEmail();
        String underageEmail = fixtureEmail();
        String invalidPhoneEmail = fixtureEmail();

        postCreate(token, email, INITIAL_PASSWORD, "\"phone\":\"0388.919.210\"")
                .andExpect(status().isCreated());
        postCreate(token, email, "Different1!", "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED_REGISTERED"));
        postCreate(token, duplicatePhoneEmail, INITIAL_PASSWORD, "\"phone\":\" 0388 919 210 \"")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEMBER_PHONE_DUPLICATED"));
        postCreate(token, invalidPasswordEmail, "weak", "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        postCreate(token, missingPasswordEmail, "", "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        postCreate(token, "not-an-email", INITIAL_PASSWORD, "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        postCreate(token, underageEmail, INITIAL_PASSWORD, "\"dateOfBirth\":\"2015-01-01\"")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MEMBER_CREATE_VALIDATION_ERROR"));
        postCreate(token, invalidPhoneEmail, INITIAL_PASSWORD, "\"phone\":\"0123-456-789\"")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MEMBER_CREATE_VALIDATION_ERROR"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class,
                duplicatePhoneEmail)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class,
                invalidPasswordEmail)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class,
                missingPasswordEmail)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class,
                underageEmail)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class,
                invalidPhoneEmail)).isZero();
    }

    @Test
    void registrationTransactionRollbackLeavesNoAccountMemberTokenOrMail() throws Exception {
        String email = fixtureEmail();
        String token = loginAsSuperAdmin();
        doThrow(new IllegalStateException("fixture-only token failure"))
                .when(verificationTokenService).issue(org.mockito.ArgumentMatchers.any(Account.class));

        mockMvc.perform(post("/api/v1/members")
                        .header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content(createBody(email, INITIAL_PASSWORD, "")))
                .andExpect(status().isInternalServerError());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class, email))
                .isZero();
        assertThat(jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FROM members m JOIN accounts a ON a.id = m.account_id WHERE a.email = ?
                        """, Integer.class, email)).isZero();
        verify(javaMailSender, org.mockito.Mockito.never()).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }

    @Test
    void registrationMailFailureDoesNotUndoCommittedAdminCreateOrExposeSecret() throws Exception {
        String email = fixtureEmail();
        doThrow(new MailSendException("fixture SMTP failure"))
                .when(javaMailSender).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));

        mockMvc.perform(post("/api/v1/members")
                        .header("Authorization", "Bearer " + loginAsSuperAdmin())
                        .contentType(APPLICATION_JSON)
                        .content(createBody(email, INITIAL_PASSWORD, "")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.password").doesNotExist());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class, email))
                .isEqualTo(1);
        Integer accountId = jdbcTemplate.queryForObject("SELECT id FROM accounts WHERE email = ?", Integer.class, email);
        Map<String, Object> optionalProfile = jdbcTemplate.queryForMap("""
                SELECT full_name, date_of_birth, phone, address FROM members WHERE account_id = ?
                """, accountId);
        assertThat(optionalProfile.get("full_name")).isNull();
        assertThat(optionalProfile.get("date_of_birth")).isNull();
        assertThat(optionalProfile.get("phone")).isNull();
        assertThat(optionalProfile.get("address")).isNull();
        String memberCode = jdbcTemplate.queryForObject("SELECT member_code FROM members WHERE account_id = ?",
                String.class, accountId);
        assertThat(memberCode).matches("M[0-9]{6,}");
        verify(javaMailSender, times(1)).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }

    @Test
    void memberCodeFormattingKeepsAllDigitsWhenMemberIdExceedsSixDigits() {
        assertThat(sparkminds.librarymanagement.auth.service.RegistrationTransactionService.memberCodeForId(1_234_567))
                .isEqualTo("M1234567");
    }

    @Test
    void concurrentAdminCreateForSameEmailCommitsExactlyOneAccountMemberTokenAndMail() throws Exception {
        String email = fixtureEmail();
        String token = loginAsSuperAdmin();
        CountDownLatch bothRequestsReady = new CountDownLatch(2);
        CountDownLatch startRequests = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentCreate(
                    token, email, bothRequestsReady, startRequests));
            Future<MvcResult> second = executor.submit(() -> concurrentCreate(
                    token, email, bothRequestsReady, startRequests));
            assertThat(bothRequestsReady.await(10, TimeUnit.SECONDS)).isTrue();
            startRequests.countDown();
            List<Integer> statuses = List.of(first.get(20, TimeUnit.SECONDS).getResponse().getStatus(),
                    second.get(20, TimeUnit.SECONDS).getResponse().getStatus());
            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        } finally {
            startRequests.countDown();
            executor.shutdownNow();
        }

        Integer accountId = jdbcTemplate.queryForObject("SELECT id FROM accounts WHERE email = ?", Integer.class, email);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members WHERE account_id = ?", Integer.class, accountId))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM email_verification_tokens WHERE account_id = ?", Integer.class, accountId))
                .isEqualTo(1);
        verify(javaMailSender, times(1)).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }

    @Test
    void userCanCreateAndDeleteOnlyAfterCurrentDatabasePermissionsAreGranted() throws Exception {
        String actorEmail = fixtureEmail();
        String actorUsername = createLoginableUser(actorEmail);
        String actorToken = login(actorEmail, INITIAL_PASSWORD);
        String targetEmail = fixtureEmail();
        int baselineRolePermissionCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM role_permissions", Integer.class);
        boolean hadCreate = hasRolePermission("ROLE_USER", "member:create");
        boolean hadDelete = hasRolePermission("ROLE_USER", "member:delete");

        try {
            setRolePermission("ROLE_USER", "member:create", false);
            setRolePermission("ROLE_USER", "member:delete", false);
            postCreate(actorToken, targetEmail, INITIAL_PASSWORD, "")
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

            int targetMemberId = createDirectFixtureMember(targetEmail);
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                            "/api/v1/members/{id}", targetMemberId)
                            .header("Authorization", "Bearer " + actorToken))
                    .andExpect(status().isForbidden());

            setRolePermission("ROLE_USER", "member:create", true);
            MvcResult created = postCreate(actorToken, fixtureEmail(), INITIAL_PASSWORD, "")
                    .andExpect(status().isCreated())
                    .andReturn();
            int createdMemberId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
            setRolePermission("ROLE_USER", "member:delete", true);
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                            "/api/v1/members/{id}", createdMemberId)
                            .header("Authorization", "Bearer " + actorToken))
                    .andExpect(status().isNoContent());
            assertThat(actorUsername).isNotBlank();
        } finally {
            setRolePermission("ROLE_USER", "member:create", hadCreate);
            setRolePermission("ROLE_USER", "member:delete", hadDelete);
        }
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM role_permissions", Integer.class))
                .isEqualTo(baselineRolePermissionCount);
    }

    @Test
    void adminTokenLosesCreateCapabilityImmediatelyWhenDatabasePermissionIsRevoked() throws Exception {
        String email = fixtureEmail();
        String adminToken = login("admin", "admin");
        boolean hadCreate = hasRolePermission("ROLE_ADMIN", "member:create");
        int baselineRolePermissionCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM role_permissions", Integer.class);
        try {
            setRolePermission("ROLE_ADMIN", "member:create", false);
            postCreate(adminToken, email, INITIAL_PASSWORD, "")
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class, email))
                    .isZero();
        } finally {
            setRolePermission("ROLE_ADMIN", "member:create", hadCreate);
        }
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM role_permissions", Integer.class))
                .isEqualTo(baselineRolePermissionCount);
    }

    @Test
    void foreignKeyRejectsDeleteWhenLoanIsInsertedAfterHistoryPrecheck() throws Exception {
        String email = fixtureEmail();
        int memberId = createDirectFixtureMember(email);
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT account_id FROM members WHERE id = ?", Integer.class, memberId);
        String token = loginAsSuperAdmin();
        CountDownLatch historyChecked = new CountDownLatch(1);
        CountDownLatch allowDeleteToContinue = new CountDownLatch(1);
        AtomicBoolean pauseFirst = new AtomicBoolean(true);
        doAnswer(invocation -> {
            boolean hasHistory = (boolean) invocation.callRealMethod();
            if (memberId == (Integer) invocation.getArgument(0) && pauseFirst.compareAndSet(true, false)) {
                historyChecked.countDown();
                if (!allowDeleteToContinue.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Loan race fixture timed out.");
                }
            }
            return hasHistory;
        }).when(memberLoanHistoryRepository).existsForMember(memberId);

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<MvcResult> deleteResponse = executor.submit(() -> mockMvc.perform(
                            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                                    "/api/v1/members/{id}", memberId)
                                    .header("Authorization", "Bearer " + token))
                    .andReturn());
            assertThat(historyChecked.await(10, TimeUnit.SECONDS)).isTrue();
            jdbcTemplate.update("""
                            INSERT INTO loans (loan_code, member_id, borrowed_at, due_date, status)
                            VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY), 'ACTIVE')
                            """,
                    "MMV8-P05-RACE-" + UUID.randomUUID().toString().substring(0, 8), memberId);
            allowDeleteToContinue.countDown();
            MvcResult result = deleteResponse.get(20, TimeUnit.SECONDS);
            assertThat(result.getResponse().getStatus()).isEqualTo(409);
            assertThat(JsonPath.<String>read(result.getResponse().getContentAsString(), "$.code"))
                    .isEqualTo("MEMBER_HAS_LOAN_HISTORY");
        } finally {
            allowDeleteToContinue.countDown();
            executor.shutdownNow();
        }

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members WHERE id = ?", Integer.class, memberId))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE id = ?", Integer.class, accountId))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM loans WHERE member_id = ?", Integer.class, memberId))
                .isEqualTo(1);
    }

    @Test
    void deleteRemovesOnlyMemberAccountAndCascadedVerificationTokensWhenThereIsNoLoanHistory() throws Exception {
        String email = fixtureEmail();
        int memberId = createDirectFixtureMember(email);
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT account_id FROM members WHERE id = ?", Integer.class, memberId);
        LoginSession userSession = loginSession(email, "Fixture1!");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                        "/api/v1/members/{id}", memberId)
                        .header("Authorization", "Bearer " + loginAsSuperAdmin()))
                .andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members WHERE id = ?", Integer.class, memberId))
                .isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE id = ?", Integer.class, accountId))
                .isZero();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + userSession.accessToken()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new Cookie(RefreshCookieFactory.NAME, userSession.refreshCookie())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteReturnsConflictAndPreservesMemberAccountAndReturnedLoanHistory() throws Exception {
        String email = fixtureEmail();
        int memberId = createDirectFixtureMember(email);
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT account_id FROM members WHERE id = ?", Integer.class, memberId);
        jdbcTemplate.update("""
                        INSERT INTO loans (loan_code, member_id, borrowed_at, due_date, status)
                        VALUES (?, ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY), 'RETURNED')
                        """,
                "MMV8-P05-RETURNED-" + UUID.randomUUID().toString().substring(0, 8), memberId);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                        "/api/v1/members/{id}", memberId)
                        .header("Authorization", "Bearer " + loginAsSuperAdmin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEMBER_HAS_LOAN_HISTORY"));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members WHERE id = ?", Integer.class, memberId))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM accounts WHERE id = ?", Integer.class, accountId))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM loans WHERE member_id = ?", Integer.class, memberId))
                .isEqualTo(1);
    }

    @Test
    void createAndDeleteRequireAuthenticationAndUnknownMemberReturnsNotFound() throws Exception {
        mockMvc.perform(post("/api/v1/members")
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                        "/api/v1/members/{id}", 2_147_000_000)
                        .header("Authorization", "Bearer " + loginAsSuperAdmin()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
    }

    private String loginAsSuperAdmin() throws Exception {
        return login("superadmin", "superadmin");
    }

    private String login(String identifier, String password) throws Exception {
        return loginSession(identifier, password).accessToken();
    }

    private LoginSession loginSession(String identifier, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + identifier + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT id FROM accounts WHERE username = ? OR email = ? ORDER BY id LIMIT 1",
                Integer.class, identifier, identifier);
        recordRefreshFixture(accountId);
        return new LoginSession(
                JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken"),
                cookieValue(result.getResponse().getHeader("Set-Cookie"))
        );
    }

    private void recordRefreshFixture(Integer accountId) {
        List<RefreshFixture> issued = jdbcTemplate.query("""
                        SELECT id, account_id, jti FROM refresh_tokens
                        WHERE account_id = ? ORDER BY id DESC LIMIT 1
                        """,
                (row, number) -> new RefreshFixture(row.getInt("id"), row.getInt("account_id"), row.getString("jti")),
                accountId);
        assertThat(issued).hasSize(1);
        adminRefreshFixtures.add(issued.get(0));
    }

    private static String cookieValue(String setCookie) {
        int valueStart = setCookie.indexOf('=') + 1;
        return setCookie.substring(valueStart, setCookie.indexOf(';', valueStart));
    }

    private org.springframework.test.web.servlet.ResultActions postCreate(
            String token,
            String email,
            String password,
            String extraFields
    ) throws Exception {
        return mockMvc.perform(post("/api/v1/members")
                .header("Authorization", "Bearer " + token)
                .contentType(APPLICATION_JSON)
                .content(createBody(email, password, extraFields)));
    }

    private MvcResult concurrentCreate(
            String token,
            String email,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Email race fixture timed out.");
        }
        return postCreate(token, email, INITIAL_PASSWORD, "").andReturn();
    }

    private static String createBody(String email, String password, String extraFields) {
        String prefix = "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"";
        return prefix + (extraFields.isBlank() ? "}" : "," + extraFields + "}");
    }

    private String fixtureEmail() {
        String email = "mmv8-p05-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12)
                + "@example.test";
        createdEmails.add(email);
        return email;
    }

    private int createDirectFixtureMember(String email) {
        jdbcTemplate.update("""
                        INSERT INTO accounts (email, password_hash, role_id, email_verified, enabled)
                        SELECT ?, ?, id, true, true FROM roles WHERE code = 'ROLE_USER'
                        """,
                email, passwordEncoder.encode("Fixture1!"));
        Integer accountId = jdbcTemplate.queryForObject(
                "SELECT id FROM accounts WHERE email = ?", Integer.class, email);
        String memberCode = "MMV8-P05-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbcTemplate.update("""
                        INSERT INTO members (account_id, member_code, full_name, created_at, updated_at)
                        VALUES (?, ?, 'Phase Five Fixture', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """,
                accountId, memberCode);
        return jdbcTemplate.queryForObject("SELECT id FROM members WHERE member_code = ?", Integer.class, memberCode);
    }

    private String createLoginableUser(String email) {
        String username = "mmv8u" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        jdbcTemplate.update("""
                        INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                        SELECT ?, ?, ?, id, true, true FROM roles WHERE code = 'ROLE_USER'
                        """,
                username, email, passwordEncoder.encode(INITIAL_PASSWORD));
        return username;
    }

    private boolean hasRolePermission(String roleCode, String permissionCode) {
        return jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FROM role_permissions rp
                        JOIN roles r ON r.id = rp.role_id
                        JOIN permissions p ON p.id = rp.permission_id
                        WHERE r.code = ? AND p.code = ?
                        """, Integer.class, roleCode, permissionCode) > 0;
    }

    private void setRolePermission(String roleCode, String permissionCode, boolean assigned) {
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
    }

    private Map<String, Long> counts() {
        Map<String, Long> result = new LinkedHashMap<>();
        for (String table : List.of("accounts", "members", "email_verification_tokens", "loans", "loan_items",
                "refresh_tokens", "revoked_access_tokens", "role_permissions")) {
            result.put(table, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        }
        return result;
    }

    private record RefreshFixture(Integer id, Integer accountId, String jti) {}
    private record LoginSession(String accessToken, String refreshCookie) {}
}
