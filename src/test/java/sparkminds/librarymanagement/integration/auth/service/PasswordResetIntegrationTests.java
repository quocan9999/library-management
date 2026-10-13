package sparkminds.librarymanagement.integration.auth.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import jakarta.servlet.http.Cookie;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.PasswordResetToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.PasswordResetTokenRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.service.VerificationTokenService;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.mail.from=notifications@example.test",
        "app.frontend.base-url=http://localhost:5174"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordResetIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @MockitoSpyBean
    private PasswordEncoder passwordEncoder;

    @Autowired
    private VerificationTokenService verificationTokenService;

    @MockitoBean
    private JavaMailSender javaMailSender;

    @MockitoBean(name = "verificationMailExecutor")
    private TaskExecutor mailExecutor;

    private final List<String> testEmails = new CopyOnWriteArrayList<>();
    private final List<SimpleMailMessage> sentMessages = new CopyOnWriteArrayList<>();

    @BeforeEach
    void runMailWorkerInline() {
        sentMessages.clear();
        doAnswer(invocation -> {
            ((Runnable) invocation.getArgument(0)).run();
            return null;
        }).when(mailExecutor).execute(any(Runnable.class));
        doAnswer(invocation -> {
            sentMessages.add(invocation.getArgument(0));
            return null;
        }).when(javaMailSender).send(any(SimpleMailMessage.class));
    }

    @AfterEach
    void removeOnlyRowsCreatedByThisTest() {
        for (String email : testEmails) {
            jdbcTemplate.update("DELETE t FROM password_reset_tokens t JOIN accounts a ON a.id = t.account_id WHERE LOWER(a.email) = LOWER(?)", email);
            jdbcTemplate.update("DELETE t FROM email_verification_tokens t JOIN accounts a ON a.id = t.account_id WHERE LOWER(a.email) = LOWER(?)", email);
            jdbcTemplate.update("DELETE m FROM members m JOIN accounts a ON a.id = m.account_id WHERE LOWER(a.email) = LOWER(?)", email);
            jdbcTemplate.update("DELETE FROM accounts WHERE LOWER(email) = LOWER(?)", email);
        }
        testEmails.clear();
    }

    @Test
    void forgotPasswordAcceptsAnUnknownEmailWithTheGenericResponse() throws Exception {
        forgotRequest(uniqueEmail(), uniqueRemoteAddress())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value("FORGOT_PASSWORD_REQUESTED"))
                .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void returnsTheSameGenericResponseAndOnlyIssuesForEligibleUsers() throws Exception {
        String userEmail = uniqueEmail();
        String adminEmail = uniqueEmail();
        String superAdminEmail = uniqueEmail();
        String disabledEmail = uniqueEmail();
        String unverifiedEmail = uniqueEmail();
        Account user = createAccount(userEmail, "ROLE_USER", true, true);
        createAccount(adminEmail, "ROLE_ADMIN", true, true);
        createAccount(superAdminEmail, "ROLE_SUPER_ADMIN", true, true);
        createAccount(disabledEmail, "ROLE_USER", false, true);
        createAccount(unverifiedEmail, "ROLE_USER", true, false);

        MvcResult unknown = forgotRequest(uniqueEmail(), uniqueRemoteAddress()).andReturn();
        MvcResult eligible = forgotRequest(userEmail, uniqueRemoteAddress()).andReturn();
        MvcResult admin = forgotRequest(adminEmail, uniqueRemoteAddress()).andReturn();
        MvcResult superAdmin = forgotRequest(superAdminEmail, uniqueRemoteAddress()).andReturn();
        MvcResult disabled = forgotRequest(disabledEmail, uniqueRemoteAddress()).andReturn();
        MvcResult unverified = forgotRequest(unverifiedEmail, uniqueRemoteAddress()).andReturn();

        assertSameGenericResponse(unknown, eligible);
        assertSameGenericResponse(unknown, admin);
        assertSameGenericResponse(unknown, superAdmin);
        assertSameGenericResponse(unknown, disabled);
        assertSameGenericResponse(unknown, unverified);
        assertThat(countResetTokens(user)).isEqualTo(1);
        assertThat(countResetTokens(adminEmail, superAdminEmail, disabledEmail, unverifiedEmail)).isZero();
        assertThat(sentMessages).hasSize(1);
        assertThat(sentMessages.get(0).getTo()).containsExactly(userEmail);
    }

    @Test
    void normalizesEmailAndSendsOnlyAHashedThirtyMinuteTokenByEmail() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, "ROLE_USER", true, true);
        LocalDateTime beforeRequest = LocalDateTime.now(ZoneOffset.UTC);

        MvcResult result = forgotRequest("  " + email.toUpperCase() + "  ", uniqueRemoteAddress()).andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain(email);
        assertThat(sentMessages).hasSize(1);
        SimpleMailMessage message = sentMessages.get(0);
        assertThat(message.getTo()).containsExactly(email);
        assertThat(message.getText()).contains("http://localhost:5174/reset-password?token=");
        String rawToken = message.getText().replaceAll("(?s).*reset-password\\?token=([A-Za-z0-9_-]+).*", "$1");
        assertThat(rawToken).matches("[A-Za-z0-9_-]{43}");
        assertThat(result.getResponse().getContentAsString()).doesNotContain(rawToken);

        PasswordResetToken token = passwordResetTokenRepository
                .findByTokenHash(verificationTokenService.hash(rawToken)).orElseThrow();
        assertThat(token.getAccount().getId()).isEqualTo(account.getId());
        assertThat(token.getTokenHash()).isNotEqualTo(rawToken);
        assertThat(token.getExpiresAt()).isBetween(
                beforeRequest.plusMinutes(30).minusSeconds(1),
                LocalDateTime.now(ZoneOffset.UTC).plusMinutes(30).plusSeconds(1));
    }

    @Test
    void mailFailureRemovesOnlyTheUnsentCandidateAndPreservesThePreviousToken() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, "ROLE_USER", true, true);
        PasswordResetToken oldToken = createResetToken(account, "previous-raw-reset-token",
                LocalDateTime.now(ZoneOffset.UTC).plusMinutes(30));
        doThrow(new MailSendException("simulated private transport detail"))
                .when(javaMailSender).send(any(SimpleMailMessage.class));

        MvcResult result = forgotRequest(email, uniqueRemoteAddress()).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).doesNotContain(email, "previous-raw-reset-token");
        assertThat(passwordResetTokenRepository.findById(oldToken.getId())).isPresent();
        assertThat(countResetTokens(account)).isEqualTo(1);
    }

    @Test
    void limitsForgotRequestsPerIpAndReturnsRetryAfter() throws Exception {
        String address = uniqueRemoteAddress();
        for (int index = 0; index < 10; index++) {
            forgotRequest(uniqueEmail(), address).andExpect(status().isOk());
        }

        forgotRequest(uniqueEmail(), address)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("FORGOT_PASSWORD_RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void invalidForgotEmailReturnsFieldValidationError() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.email").isNotEmpty());
    }

    @Test
    void invalidExpiredOrUsedResetTokensDoNotChangePasswordOrSessionVersion() throws Exception {
        Account expiredAccount = createAccount(uniqueEmail(), "ROLE_USER", true, true);
        Account usedAccount = createAccount(uniqueEmail(), "ROLE_USER", true, true);
        String expiredOriginalHash = expiredAccount.getPasswordHash();
        String usedOriginalHash = usedAccount.getPasswordHash();
        long originalRefreshCount = refreshTokenRepository.count();
        String expiredRawToken = "expired-" + UUID.randomUUID();
        String usedRawToken = "used-" + UUID.randomUUID();
        PasswordResetToken expired = createResetToken(expiredAccount, expiredRawToken,
                LocalDateTime.now(ZoneOffset.UTC).minusSeconds(1));
        PasswordResetToken used = createResetToken(usedAccount, usedRawToken,
                LocalDateTime.now(ZoneOffset.UTC).plusMinutes(30));
        used.setUsedAt(LocalDateTime.now(ZoneOffset.UTC));
        passwordResetTokenRepository.saveAndFlush(used);

        resetRequest("unknown-token", "Strong2!Password", "Strong2!Password")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));
        resetRequest(expiredRawToken, "Strong2!Password", "Strong2!Password")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));
        resetRequest(usedRawToken, "Strong2!Password", "Strong2!Password")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));

        assertThat(expired.getUsedAt()).isNull();
        Account expiredUnchanged = accountRepository.findById(expiredAccount.getId()).orElseThrow();
        Account usedUnchanged = accountRepository.findById(usedAccount.getId()).orElseThrow();
        assertThat(expiredUnchanged.getPasswordHash()).isEqualTo(expiredOriginalHash);
        assertThat(expiredUnchanged.getSessionVersion()).isZero();
        assertThat(usedUnchanged.getPasswordHash()).isEqualTo(usedOriginalHash);
        assertThat(usedUnchanged.getSessionVersion()).isZero();
        assertThat(passwordResetTokenRepository.findById(used.getId()).orElseThrow().getUsedAt()).isNotNull();
        assertThat(refreshTokenRepository.count()).isEqualTo(originalRefreshCount);
    }

    @Test
    void doesNotResetAnAdminEvenIfAnAdminTokenRowExists() throws Exception {
        Account admin = createAccount(uniqueEmail(), "ROLE_ADMIN", true, true);
        Account superAdmin = createAccount(uniqueEmail(), "ROLE_SUPER_ADMIN", true, true);
        Account disabled = createAccount(uniqueEmail(), "ROLE_USER", false, true);
        Account unverified = createAccount(uniqueEmail(), "ROLE_USER", true, false);
        List<Account> ineligibleAccounts = List.of(admin, superAdmin, disabled, unverified);
        List<String> rawTokens = ineligibleAccounts.stream().map(account -> "ineligible-" + UUID.randomUUID()).toList();
        List<PasswordResetToken> tokens = ineligibleAccounts.stream()
                .map(account -> createResetToken(account, rawTokens.get(ineligibleAccounts.indexOf(account)),
                        LocalDateTime.now(ZoneOffset.UTC).plusMinutes(30)))
                .toList();
        List<String> originalHashes = ineligibleAccounts.stream().map(Account::getPasswordHash).toList();

        for (String rawToken : rawTokens) {
            resetRequest(rawToken, "NewPass1!", "NewPass1!")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));
        }

        for (int index = 0; index < ineligibleAccounts.size(); index++) {
            Account unchanged = accountRepository.findById(ineligibleAccounts.get(index).getId()).orElseThrow();
            PasswordResetToken unchangedToken = passwordResetTokenRepository.findById(tokens.get(index).getId()).orElseThrow();
            assertThat(unchanged.getPasswordHash()).isEqualTo(originalHashes.get(index));
            assertThat(unchanged.getSessionVersion()).isZero();
            assertThat(unchangedToken.getUsedAt()).isNull();
        }
    }

    @Test
    void rollsBackTokenUseWhenPasswordHashingFails() throws Exception {
        Account account = createAccount(uniqueEmail(), "ROLE_USER", true, true);
        String originalHash = account.getPasswordHash();
        String rawToken = "rollback-" + UUID.randomUUID();
        PasswordResetToken token = createResetToken(account, rawToken, LocalDateTime.now(ZoneOffset.UTC).plusMinutes(30));
        doReturn(null).when(passwordEncoder).encode("Rollback4!");

        resetRequest(rawToken, "Rollback4!", "Rollback4!")
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));

        Account unchanged = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(unchanged.getPasswordHash()).isEqualTo(originalHash);
        assertThat(unchanged.getSessionVersion()).isZero();
        assertThat(passwordResetTokenRepository.findById(token.getId()).orElseThrow().getUsedAt()).isNull();
    }

    @Test
    void onlyNewestResetTokenWorksAndSuccessfulResetConsumesItOnce() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, "ROLE_USER", true, true);
        LocalDateTime expiresAt = LocalDateTime.now(ZoneOffset.UTC).plusMinutes(30);
        String oldRawToken = "old-" + UUID.randomUUID();
        String newestRawToken = "new-" + UUID.randomUUID();
        createResetToken(account, oldRawToken, expiresAt);
        PasswordResetToken newest = createResetToken(account, newestRawToken, expiresAt);

        resetRequest(oldRawToken, "NewPass1!", "NewPass1!")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));
        assertThat(passwordEncoder.matches("Existing1!", accountRepository.findById(account.getId()).orElseThrow()
                .getPasswordHash())).isTrue();
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getSessionVersion()).isZero();

        resetRequest(newestRawToken, "NewPass1!", "NewPass1!")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PASSWORD_RESET_SUCCESS"));
        Account updated = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("NewPass1!", updated.getPasswordHash())).isTrue();
        assertThat(updated.getSessionVersion()).isEqualTo(1);
        assertThat(passwordResetTokenRepository.findById(newest.getId()).orElseThrow().getUsedAt()).isNotNull();

        resetRequest(newestRawToken, "Another2!", "Another2!")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getSessionVersion()).isEqualTo(1);
        assertThat(passwordEncoder.matches("NewPass1!", accountRepository.findById(account.getId()).orElseThrow()
                .getPasswordHash())).isTrue();
    }

    @Test
    void successfulResetInvalidatesExistingAccessAndRefreshSessionsAndAllowsNewPasswordLogin() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, "ROLE_USER", true, true);
        MvcResult login = login(email, "Existing1!").andExpect(status().isOk()).andReturn();
        String accessToken = new tools.jackson.databind.ObjectMapper()
                .readTree(login.getResponse().getContentAsString()).get("data").get("accessToken").asText();
        String refreshCookie = login.getResponse().getHeader("Set-Cookie");
        String refreshToken = refreshCookie.substring("refreshToken=".length(), refreshCookie.indexOf(';'));
        String rawResetToken = requestResetLink(email);
        long originalVersion = accountRepository.findById(account.getId()).orElseThrow().getSessionVersion();

        resetRequest(rawResetToken, "Fresh3!Password", "Fresh3!Password")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PASSWORD_RESET_SUCCESS"));

        Account updated = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(updated.getSessionVersion()).isEqualTo(originalVersion + 1);
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refreshToken", refreshToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_REVOKED"));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());
        login(email, "Existing1!").andExpect(status().isUnauthorized());
        login(email, "Fresh3!Password").andExpect(status().isOk());
    }

    @Test
    void concurrentSubmissionsOfOneResetTokenChangeThePasswordAndVersionOnlyOnce() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, "ROLE_USER", true, true);
        String rawToken = requestResetLink(email);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = executor.submit(() -> resetAfterBarrier(
                    rawToken, "Concurrent1!", ready, start));
            Future<Integer> second = executor.submit(() -> resetAfterBarrier(
                    rawToken, "Concurrent2!", ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<Integer> statuses = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(200, 400);
            Account updated = accountRepository.findById(account.getId()).orElseThrow();
            assertThat(updated.getSessionVersion()).isEqualTo(1);
            assertThat(passwordEncoder.matches("Concurrent1!", updated.getPasswordHash())
                    || passwordEncoder.matches("Concurrent2!", updated.getPasswordHash())).isTrue();
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void resetPasswordValidatesPasswordPolicyAndConfirmation() throws Exception {
        resetRequest("unknown-token", "weak", "weak")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());
        resetRequest("unknown-token", "Strong1!", "Different2!")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.confirmNewPassword").isNotEmpty());
    }

    private ResultActions forgotRequest(String email, String remoteAddress) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/forgot-password")
                .with(request -> {
                    request.setRemoteAddr(remoteAddress);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"));
    }

    private ResultActions resetRequest(String rawToken, String newPassword, String confirmNewPassword)
            throws Exception {
        return mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + rawToken + "\",\"newPassword\":\"" + newPassword
                        + "\",\"confirmNewPassword\":\"" + confirmNewPassword + "\"}"));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"identifier\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private String requestResetLink(String email) throws Exception {
        MvcResult result = forgotRequest(email, uniqueRemoteAddress()).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(sentMessages).isNotEmpty();
        return sentMessages.get(sentMessages.size() - 1).getText()
                .replaceAll("(?s).*reset-password\\?token=([A-Za-z0-9_-]+).*", "$1");
    }

    private int resetAfterBarrier(
            String rawToken,
            String newPassword,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("reset token barrier timed out");
        }
        return resetRequest(rawToken, newPassword, newPassword).andReturn().getResponse().getStatus();
    }

    private Account createAccount(String email, String roleCode, boolean enabled, boolean verified) {
        testEmails.add(email);
        Account account = new Account();
        account.setEmail(email);
        account.setPasswordHash(passwordEncoder.encode("Existing1!"));
        account.setRole(roleRepository.findByCode(roleCode).orElseThrow());
        account.setEnabled(enabled);
        account.setEmailVerified(verified);
        return accountRepository.saveAndFlush(account);
    }

    private PasswordResetToken createResetToken(Account account, String rawToken, LocalDateTime expiresAt) {
        PasswordResetToken token = new PasswordResetToken();
        token.setAccount(account);
        token.setTokenHash(verificationTokenService.hash(rawToken));
        token.setExpiresAt(expiresAt);
        return passwordResetTokenRepository.saveAndFlush(token);
    }

    private int countResetTokens(Account account) {
        return countResetTokens(account.getEmail());
    }

    private int countResetTokens(String... emails) {
        int count = 0;
        for (String email : emails) {
            count += jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM password_reset_tokens t JOIN accounts a ON a.id = t.account_id WHERE LOWER(a.email) = LOWER(?)",
                    Integer.class,
                    email);
        }
        return count;
    }

    private void assertSameGenericResponse(MvcResult expected, MvcResult actual) throws Exception {
        assertThat(actual.getResponse().getStatus()).isEqualTo(expected.getResponse().getStatus());
        var objectMapper = new tools.jackson.databind.ObjectMapper();
        var expectedBody = objectMapper.readTree(expected.getResponse().getContentAsString());
        var actualBody = objectMapper.readTree(actual.getResponse().getContentAsString());
        for (String field : List.of("success", "status", "code", "message", "data")) {
            assertThat(actualBody.get(field)).isEqualTo(expectedBody.get(field));
        }
    }

    private String uniqueEmail() {
        return UUID.randomUUID() + "@example.com";
    }

    private String uniqueRemoteAddress() {
        return "203.0.113." + UUID.randomUUID();
    }
}
