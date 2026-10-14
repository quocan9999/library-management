package sparkminds.librarymanagement.integration.adminaccount;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sparkminds.librarymanagement.auth.entity.RefreshToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.mail.from=notifications@example.test",
        "app.frontend.base-url=http://localhost:5174"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAccountManagementIntegrationTests {
    private static final Pattern TOKEN_PATTERN = Pattern.compile("token=([A-Za-z0-9_-]+)");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AccountRepository accountRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private JwtTokenService jwtTokenService;

    @MockitoBean private JavaMailSender mailSender;

    private final List<Integer> accountIds = new ArrayList<>();
    private final List<String> roleCodes = new ArrayList<>();

    @AfterEach
    void cleanupFixtures() {
        for (Integer id : accountIds) {
            jdbc.update("DELETE FROM email_verification_tokens WHERE account_id = ?", id);
            jdbc.update("DELETE FROM email_change_verifications WHERE account_id = ?", id);
            jdbc.update("DELETE FROM password_reset_tokens WHERE account_id = ?", id);
            jdbc.update("DELETE FROM refresh_tokens WHERE account_id = ?", id);
            jdbc.update("DELETE FROM revoked_access_tokens WHERE account_id = ?", id);
            jdbc.update("DELETE FROM members WHERE account_id = ?", id);
            jdbc.update("DELETE FROM accounts WHERE id = ?", id);
        }
        for (String role : roleCodes) {
            jdbc.update("DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE code = ?)", role);
            jdbc.update("DELETE FROM roles WHERE code = ?", role);
        }
    }

    @Test
    void createsAdminWithoutMemberAndVerifiesThroughExistingFlowBeforeLogin() throws Exception {
        String adminToken = login("admin", "admin").accessToken();
        String username = "adm" + suffix(8);
        String email = username + "@example.test";

        mockMvc.perform(post("/api/v1/admin/accounts")
                        .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"this-username-is-over-twenty\",\"email\":\"not-an-email\","
                                + "\"password\":\"weak\",\"roleCode\":\"ADMIN\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(post("/api/v1/admin/accounts")
                        .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"email\":\"" + email
                                + "\",\"password\":\"Strong1!\",\"roleCode\":\"USER\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ROLE_ASSIGNMENT_FORBIDDEN"));

        MvcResult created = mockMvc.perform(post("/api/v1/admin/accounts")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"email\":\" " + email.toUpperCase()
                                + " \",\"password\":\"Strong1!\",\"roleCode\":\"ADMIN\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.username").value(username))
                .andExpect(jsonPath("$.data.emailVerified").value(false))
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.systemAccount").value(false))
                .andExpect(jsonPath("$.data.sessionVersion").value(0))
                .andReturn();
        assertThat(created.getResponse().getHeader("Location")).contains("/api/v1/admin/accounts/");
        assertThat(created.getResponse().getContentAsString()).doesNotContain("passwordHash", "Strong1!");

        Integer id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
        accountIds.add(id);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM members WHERE account_id = ?", Integer.class, id)).isZero();
        String passwordHash = jdbc.queryForObject("SELECT password_hash FROM accounts WHERE id = ?", String.class, id);
        assertThat(passwordEncoder.matches("Strong1!", passwordHash)).isTrue();

        var mail = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(mail.capture());
        assertThat(mail.getValue().getTo()).containsExactly(email);
        Matcher tokenMatcher = TOKEN_PATTERN.matcher(mail.getValue().getText());
        assertThat(tokenMatcher.find()).isTrue();
        String verificationToken = tokenMatcher.group(1);

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"" + username + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));

        var unverifiedRefreshToken = jwtTokenService.issue(id, 0, JwtTokenType.REFRESH);
        RefreshToken refreshMetadata = new RefreshToken();
        refreshMetadata.setAccount(accountRepository.findById(id).orElseThrow());
        refreshMetadata.setJti(unverifiedRefreshToken.jti());
        refreshMetadata.setExpiresAt(LocalDateTime.ofInstant(unverifiedRefreshToken.expiresAt(), ZoneOffset.UTC));
        refreshTokenRepository.saveAndFlush(refreshMetadata);
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", unverifiedRefreshToken.value())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));

        mockMvc.perform(post("/api/v1/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + verificationToken + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("EMAIL_VERIFIED"));
        login(username, "Strong1!");
    }

    @Test
    void adminAccountApiIsAdminOnlyAndNeverReturnsUserAccounts() throws Exception {
        mockMvc.perform(get("/api/v1/admin/accounts"))
                .andExpect(status().isUnauthorized());

        String userToken = login("user", "user").accessToken();
        mockMvc.perform(get("/api/v1/admin/accounts").header("Authorization", bearer(userToken)))
                .andExpect(status().isForbidden());

        String adminToken = login("admin", "admin").accessToken();
        MvcResult response = mockMvc.perform(get("/api/v1/admin/accounts")
                        .header("Authorization", bearer(adminToken)).param("page", "0").param("size", "50"))
                .andExpect(status().isOk())
                .andReturn();
        List<String> roleCodesInResult = JsonPath.read(response.getResponse().getContentAsString(), "$.data.content[*].roleCode");
        assertThat(roleCodesInResult).doesNotContain("USER");

        mockMvc.perform(get("/api/v1/admin/accounts").header("Authorization", bearer(adminToken)).param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADMIN_ACCOUNT_SEARCH_INVALID"));
        mockMvc.perform(get("/api/v1/admin/accounts").header("Authorization", bearer(adminToken)).param("sort", "email desc; delete"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADMIN_ACCOUNT_SEARCH_INVALID"));
        mockMvc.perform(get("/api/v1/admin/accounts").header("Authorization", bearer(adminToken)).param("page", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST_PARAMETER"));
    }

    @Test
    void roleAndStatusChangesInvalidateExistingAccessAndRefreshSessionsWithDistinctReasons() throws Exception {
        createRole("LIBRARIAN");
        Integer targetId = createFixtureAccount("rolechange" + suffix(7), "LIBRARIAN");
        String username = username(targetId);
        LoginTokens oldRoleTokens = login(username, "Strong1!");
        String actorToken = login("admin", "admin").accessToken();

        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/role", targetId)
                        .header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"ADMIN\",\"expectedSessionVersion\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roleCode").value("ADMIN"))
                .andExpect(jsonPath("$.data.sessionVersion").value(1));

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(oldRoleTokens.accessToken())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_ROLE_CHANGED"));
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("refreshToken", oldRoleTokens.refreshToken())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_ROLE_CHANGED"));

        LoginTokens current = login(username, "Strong1!");
        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/status", targetId)
                        .header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false,\"expectedSessionVersion\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(current.accessToken())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"));
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("refreshToken", current.refreshToken())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"));

        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/status", targetId)
                        .header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"expectedSessionVersion\":2}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(current.accessToken())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_TOKEN_INVALID"));
    }

    @Test
    void concurrentRoleEditsUseAccountLockAndExpectedSessionVersion() throws Exception {
        createRole("LIBRARIAN");
        createRole("ASSISTANT");
        Integer targetId = createFixtureAccount("racerole" + suffix(7), "LIBRARIAN");
        String actorToken = login("admin", "admin").accessToken();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        Callable<Integer> assignAdmin = roleRaceRequest(actorToken, targetId, "ADMIN", ready, start);
        Callable<Integer> assignAssistant = roleRaceRequest(actorToken, targetId, "ASSISTANT", ready, start);
        Future<Integer> first = executor.submit(assignAdmin);
        Future<Integer> second = executor.submit(assignAssistant);
        try {
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            assertThat(statuses).contains(200, 409);
            assertThat(jdbc.queryForObject("SELECT session_version FROM accounts WHERE id = ?", Long.class, targetId)).isEqualTo(1L);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void rejectsInactiveDestinationRoleWithoutChangingAccountOrSessions() throws Exception {
        createRole("LIBRARIAN");
        createRole("ASSISTANT");
        jdbc.update("UPDATE roles SET enabled = false WHERE code = 'ASSISTANT'");
        Integer targetId = createFixtureAccount("inactive" + suffix(8), "LIBRARIAN");
        String actorToken = login("admin", "admin").accessToken();

        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/role", targetId)
                        .header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"ASSISTANT\",\"expectedSessionVersion\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ROLE_ASSIGNMENT_FORBIDDEN"));
        assertThat(jdbc.queryForObject("SELECT session_version FROM accounts WHERE id = ?", Long.class, targetId)).isZero();
        assertThat(jdbc.queryForObject("SELECT r.code FROM accounts a JOIN roles r ON r.id = a.role_id WHERE a.id = ?", String.class, targetId))
                .isEqualTo("LIBRARIAN");
    }

    @Test
    void duplicateAccountIdentifiersReturnFriendlyConflictAndUserIdIsHidden() throws Exception {
        String adminToken = login("admin", "admin").accessToken();
        String username = "dup" + suffix(8);
        String email = username + "@example.test";
        MvcResult created = mockMvc.perform(post("/api/v1/admin/accounts")
                        .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"email\":\"" + email
                                + "\",\"password\":\"Strong1!\",\"roleCode\":\"ADMIN\"}"))
                .andExpect(status().isCreated()).andReturn();
        Integer id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
        accountIds.add(id);

        mockMvc.perform(post("/api/v1/admin/accounts")
                        .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"email\":\"other" + email
                                + "\",\"password\":\"Strong1!\",\"roleCode\":\"ADMIN\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_USERNAME_DUPLICATED"));

        mockMvc.perform(post("/api/v1/admin/accounts")
                        .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"other" + suffix(7) + "\",\"email\":\"" + email
                                + "\",\"password\":\"Strong1!\",\"roleCode\":\"ADMIN\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_EMAIL_DUPLICATED"));

        Integer userId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'user'", Integer.class);
        mockMvc.perform(get("/api/v1/admin/accounts/{id}", userId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void protectsSystemAdminAndRejectsSelfMutation() throws Exception {
        createRole("LIBRARIAN");
        String rootToken = login("admin", "admin").accessToken();
        Integer rootId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = 'admin'", Integer.class);
        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/role", rootId)
                        .header("Authorization", bearer(rootToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"LIBRARIAN\",\"expectedSessionVersion\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SYSTEM_PROTECTED"));
        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/status", rootId)
                        .header("Authorization", bearer(rootToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false,\"expectedSessionVersion\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SYSTEM_PROTECTED"));

        Integer actorId = createFixtureAccount("actor" + suffix(8), "ADMIN");
        String actorToken = login(username(actorId), "Strong1!").accessToken();
        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/role", actorId)
                        .header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"LIBRARIAN\",\"expectedSessionVersion\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SELF_ROLE_CHANGE_FORBIDDEN"));
        mockMvc.perform(patch("/api/v1/admin/accounts/{id}/status", actorId)
                        .header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false,\"expectedSessionVersion\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SELF_DISABLE_FORBIDDEN"));
    }

    private Integer createFixtureAccount(String username, String roleCode) {
        String email = username + "@example.test";
        jdbc.update("""
                INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled, is_system_account, session_version, last_session_change_reason)
                SELECT ?, ?, ?, id, true, true, false, 0, 'OTHER' FROM roles WHERE code = ?
                """, username, email, passwordEncoder.encode("Strong1!"), roleCode);
        Integer id = jdbc.queryForObject("SELECT id FROM accounts WHERE username = ?", Integer.class, username);
        accountIds.add(id);
        return id;
    }

    private void createRole(String code) {
        jdbc.update("INSERT INTO roles (code, display_name, description, enabled, version) VALUES (?, ?, ?, true, 0)",
                code, code, code);
        roleCodes.add(code);
    }

    private String username(Integer id) {
        return jdbc.queryForObject("SELECT username FROM accounts WHERE id = ?", String.class, id);
    }

    private LoginTokens login(String identifier, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"" + identifier + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String access = JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
        var cookie = result.getResponse().getCookie("refreshToken");
        return new LoginTokens(access, cookie.getValue());
    }

    private Callable<Integer> roleRaceRequest(String actorToken, Integer accountId, String roleCode,
                                              CountDownLatch ready, CountDownLatch start) {
        return () -> {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("account role race did not start");
            return mockMvc.perform(patch("/api/v1/admin/accounts/{id}/role", accountId)
                            .header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"roleCode\":\"" + roleCode + "\",\"expectedSessionVersion\":0}"))
                    .andReturn().getResponse().getStatus();
        };
    }

    private static String suffix(int length) {
        return UUID.randomUUID().toString().replace("-", "").substring(0, length);
    }

    private static String bearer(String token) { return "Bearer " + token; }
    private record LoginTokens(String accessToken, String refreshToken) { }
}
