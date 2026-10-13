package sparkminds.librarymanagement.integration.auth.service;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailChangeVerification;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailChangeVerificationRepository;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.profile.dto.ChangeEmailRequest;
import sparkminds.librarymanagement.profile.service.EmailChangeService;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChangeEmailIntegrationTests {

    private static final String CHANGE_EMAIL_REQUEST_PATH = "/api/v1/profile/change-email/request";
    private static final String CHANGE_EMAIL_VERIFY_PATH = "/api/v1/profile/change-email/verify";
    private static final String CURRENT_PASSWORD = "Current1!";
    private static final Pattern SIX_DIGIT_CODE = Pattern.compile("(?<!\\d)\\d{6}(?!\\d)");
    private static final AtomicInteger CLIENT_IP_COUNTER = new AtomicInteger();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private EmailChangeVerificationRepository emailChangeVerificationRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private Clock clock;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EmailChangeService emailChangeService;

    @MockitoBean
    private JavaMailSender javaMailSender;

    private final Set<Integer> fixtureAccountIds = ConcurrentHashMap.newKeySet();

    @AfterEach
    void deleteFixtures() {
        fixtureAccountIds.forEach(accountId -> {
            jdbcTemplate.update("DELETE FROM email_change_verifications WHERE account_id = ?", accountId);
            jdbcTemplate.update("DELETE FROM refresh_tokens WHERE account_id = ?", accountId);
            accountRepository.deleteById(accountId);
        });
        fixtureAccountIds.clear();
    }

    @Test
    void sendsHashedTenMinuteCodeToNormalizedNewEmailWithoutChangingAccountEmail() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String newEmail = "  New.Address+Library@Example.COM  ";

        MvcResult response = requestEmailChange(accessToken, newEmail, CURRENT_PASSWORD, nextClientIp())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_CODE_SENT"))
                .andReturn();

        String rawCode = readLatestCode();
        Account unchanged = accountRepository.findById(account.getId()).orElseThrow();
        EmailChangeVerification verification = latestVerification(account.getId());
        LocalDateTime now = LocalDateTime.now(clock);

        assertThat(unchanged.getEmail()).isEqualTo(account.getEmail());
        assertThat(unchanged.isEmailVerified()).isTrue();
        assertThat(verification.getNewEmail()).isEqualTo("new.address+library@example.com");
        assertThat(verification.getCodeHash()).isNotEqualTo(rawCode);
        assertThat(passwordEncoder.matches(rawCode, verification.getCodeHash())).isTrue();
        assertThat(verification.getExpiresAt()).isAfter(now.plusMinutes(9).minusSeconds(2));
        assertThat(verification.getExpiresAt()).isBefore(now.plusMinutes(10).plusSeconds(2));
        assertThat(response.getResponse().getContentAsString()).doesNotContain(rawCode, CURRENT_PASSWORD);

        ArgumentCaptor<SimpleMailMessage> messageCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(javaMailSender).send(messageCaptor.capture());
        assertThat(messageCaptor.getValue().getTo()).containsExactly("new.address+library@example.com");
        assertThat(messageCaptor.getValue().getText()).contains(rawCode);
    }

    @Test
    void rejectsWrongCurrentPasswordSameEmailAndEmailOwnedByAnotherAccount() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        Account otherAccount = createAccount("ROLE_USER");

        requestEmailChange(accessToken, "different@example.com", "WrongPass2!", nextClientIp())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INVALID"));
        requestEmailChange(accessToken, "  " + account.getEmail().toUpperCase() + "  ", CURRENT_PASSWORD,
                nextClientIp())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.newEmail").isNotEmpty());
        requestEmailChange(accessToken, otherAccount.getEmail(), CURRENT_PASSWORD, nextClientIp())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));

        assertThat(emailChangeVerificationRepository.findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(
                account.getId())).isEmpty();
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(account.getEmail());
        verify(javaMailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void replacedCodeCannotChangeEmailAndSuccessfulCodeKeepsEveryExistingSession() throws Exception {
        Account account = createAccount("ROLE_USER");
        String originalEmail = account.getEmail();
        MvcResult firstLogin = login(originalEmail, CURRENT_PASSWORD);
        String firstAccessToken = readAccessToken(firstLogin);
        String firstRefreshToken = refreshCookieValue(firstLogin);
        MvcResult secondLogin = login(originalEmail, CURRENT_PASSWORD);
        String secondAccessToken = readAccessToken(secondLogin);
        String secondRefreshToken = refreshCookieValue(secondLogin);
        long originalSessionVersion = account.getSessionVersion();

        requestEmailChange(firstAccessToken, "first-" + UUID.randomUUID() + "@example.com", CURRENT_PASSWORD,
                nextClientIp()).andExpect(status().isOk());
        String replacedCode = readLatestCode();
        requestEmailChange(firstAccessToken, "final-" + UUID.randomUUID() + "@example.com", CURRENT_PASSWORD,
                nextClientIp()).andExpect(status().isOk());
        String currentCode = readLatestCode();
        String newEmail = latestVerification(account.getId()).getNewEmail();

        verifyEmailChange(firstAccessToken, replacedCode, nextClientIp())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_CODE_INVALID"));
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(originalEmail);

        EmailChangeVerification currentVerification = latestVerification(account.getId());
        currentVerification.setCodeHash(passwordEncoder.encode("012345"));
        emailChangeVerificationRepository.saveAndFlush(currentVerification);
        verifyEmailChange(firstAccessToken, "012345", nextClientIp())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGED"));

        Account updated = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(updated.getEmail()).isEqualTo(newEmail);
        assertThat(updated.isEmailVerified()).isTrue();
        assertThat(updated.getSessionVersion()).isEqualTo(originalSessionVersion);
        assertThat(emailChangeVerificationRepository.findById(currentVerification.getId()).orElseThrow().getUsedAt())
                .isNotNull();

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + firstAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(newEmail));
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + secondAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(newEmail));
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(refreshCookie(firstRefreshToken)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(refreshCookie(secondRefreshToken)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", originalEmail, "password", CURRENT_PASSWORD))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", newEmail, "password", CURRENT_PASSWORD))))
                .andExpect(status().isOk());
        verifyEmailChange(firstAccessToken, "012345", nextClientIp())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_CODE_INVALID"));
        assertThat(currentCode).matches("\\d{6}");
    }

    @Test
    void expiredCodeLeavesEmailAndSessionVersionUnchanged() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String originalEmail = account.getEmail();
        String newEmail = "expired-" + UUID.randomUUID() + "@example.com";

        requestEmailChange(accessToken, newEmail, CURRENT_PASSWORD, nextClientIp()).andExpect(status().isOk());
        String code = readLatestCode();
        EmailChangeVerification verification = latestVerification(account.getId());
        verification.setExpiresAt(LocalDateTime.now(clock).minusSeconds(1));
        emailChangeVerificationRepository.saveAndFlush(verification);

        verifyEmailChange(accessToken, code, nextClientIp())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_CODE_INVALID"));
        Account unchanged = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(unchanged.getEmail()).isEqualTo(originalEmail);
        assertThat(unchanged.getSessionVersion()).isZero();
    }

    @Test
    void failedEmailDeliveryDoesNotReturnSuccessOrLeaveUsablePendingCode() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        doThrow(new MailSendException("private SMTP detail"))
                .when(javaMailSender).send(any(SimpleMailMessage.class));

        String response = requestEmailChange(accessToken, "mail-failure-" + UUID.randomUUID() + "@example.com",
                CURRENT_PASSWORD, nextClientIp())
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_EMAIL_SEND_FAILED"))
                .andReturn().getResponse().getContentAsString();

        assertThat(response).doesNotContain("private SMTP detail", CURRENT_PASSWORD);
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(account.getEmail());
        assertThat(emailChangeVerificationRepository.findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(
                account.getId())).isEmpty();
    }

    @Test
    void anonymousUserAndNonUserRoleCannotRequestEmailChangeEvenWithPermission() throws Exception {
        requestEmailChange("", "target@example.com", CURRENT_PASSWORD, nextClientIp())
                .andExpect(status().isUnauthorized());

        permissionRepository.findByCode("account:change-email").orElseThrow();
        removePermission("ROLE_USER", "account:change-email");
        try {
            Account userWithoutPermission = createAccount("ROLE_USER");
            String userToken = readAccessToken(login(userWithoutPermission.getEmail(), CURRENT_PASSWORD));
            requestEmailChange(userToken, "missing-permission@example.com", CURRENT_PASSWORD, nextClientIp())
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        } finally {
            addPermission("ROLE_USER", "account:change-email");
        }

        addPermission("ROLE_ADMIN", "account:change-email");
        try {
            Account admin = createAccount("ROLE_ADMIN");
            String adminToken = readAccessToken(login(admin.getEmail(), CURRENT_PASSWORD));
            requestEmailChange(adminToken, "admin-target@example.com", CURRENT_PASSWORD, nextClientIp())
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        } finally {
            removePermission("ROLE_ADMIN", "account:change-email");
        }
    }

    @Test
    void rejectsMalformedCodeAndRateLimitsRepeatedGuessesWithoutChangingEmail() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String originalEmail = account.getEmail();
        requestEmailChange(accessToken, "rate-limit-" + UUID.randomUUID() + "@example.com", CURRENT_PASSWORD,
                nextClientIp()).andExpect(status().isOk());

        verifyEmailChange(accessToken, "01234", nextClientIp())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        String guessClientIp = nextClientIp();
        for (int attempt = 0; attempt < 10; attempt++) {
            verifyEmailChange(accessToken, "999999", guessClientIp)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_CODE_INVALID"));
        }
        verifyEmailChange(accessToken, "999999", guessClientIp)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_RATE_LIMITED"));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(originalEmail);
        assertThat(emailChangeVerificationRepository.findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(
                account.getId())).isPresent();
    }

    @Test
    void appliesSendCooldownAndKeepsFirstCodeUsableWhenSecondSendIsThrottled() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String newEmail = "cooldown-" + UUID.randomUUID() + "@example.com";

        requestEmailChange(accessToken, newEmail, CURRENT_PASSWORD, nextClientIp()).andExpect(status().isOk());
        String firstCode = readLatestCode();
        requestEmailChange(accessToken, newEmail, CURRENT_PASSWORD, nextClientIp())
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGE_RATE_LIMITED"));

        assertThat(emailChangeVerificationRepository.findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(
                account.getId())).isPresent();
        verify(javaMailSender, times(1)).send(any(SimpleMailMessage.class));
        verifyEmailChange(accessToken, firstCode, nextClientIp())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("EMAIL_CHANGED"));
    }

    @Test
    void preservesUnverifiedFlagWhenVerifiedCodeChangesEmail() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String newEmail = "unverified-" + UUID.randomUUID() + "@example.com";
        jdbcTemplate.update("UPDATE accounts SET email_verified = false WHERE id = ?", account.getId());

        long originalSessionVersion = account.getSessionVersion();
        assertThat(accessToken).isNotBlank();
        emailChangeService.requestChange(account.getId(), new ChangeEmailRequest(newEmail, CURRENT_PASSWORD), nextClientIp());
        EmailChangeVerification verification = latestVerification(account.getId());
        verification.setCodeHash(passwordEncoder.encode("012345"));
        emailChangeVerificationRepository.saveAndFlush(verification);
        emailChangeService.verify(account.getId(), "012345", nextClientIp());

        Account updated = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(updated.getEmail()).isEqualTo(newEmail);
        assertThat(updated.isEmailVerified()).isFalse();
        assertThat(updated.getSessionVersion()).isEqualTo(originalSessionVersion);
    }

    @Test
    void rechecksEmailOwnershipAtVerificationAndDoesNotConsumeCodeOnConflict() throws Exception {
        Account account = createAccount("ROLE_USER");
        Account owner = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String targetEmail = "raced-" + UUID.randomUUID() + "@example.com";

        requestEmailChange(accessToken, targetEmail, CURRENT_PASSWORD, nextClientIp()).andExpect(status().isOk());
        String code = readLatestCode();
        jdbcTemplate.update("UPDATE accounts SET email = ? WHERE id = ?", targetEmail, owner.getId());

        verifyEmailChange(accessToken, code, nextClientIp())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(account.getEmail());
        assertThat(latestVerification(account.getId()).getUsedAt()).isNull();
    }

    @Test
    void concurrentAccountsChangingToSameEmailAllowOnlyOneAndReturnConflictForOther() throws Exception {
        Account first = createAccount("ROLE_USER");
        Account second = createAccount("ROLE_USER");
        String firstToken = readAccessToken(login(first.getEmail(), CURRENT_PASSWORD));
        String secondToken = readAccessToken(login(second.getEmail(), CURRENT_PASSWORD));
        String targetEmail = "concurrent-" + UUID.randomUUID() + "@example.com";
        savePendingCode(first, targetEmail, "314159");
        savePendingCode(second, targetEmail, "314159");

        var executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            var firstResult = executor.submit(() -> concurrentVerify(firstToken, ready, start));
            var secondResult = executor.submit(() -> concurrentVerify(secondToken, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            var firstResponse = firstResult.get(30, TimeUnit.SECONDS);
            var secondResponse = secondResult.get(30, TimeUnit.SECONDS);
            assertThat(List.of(firstResponse.getResponse().getStatus(), secondResponse.getResponse().getStatus()))
                    .as("Responses: %s | %s", firstResponse.getResponse().getContentAsString(),
                            secondResponse.getResponse().getContentAsString())
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(accountRepository.findByEmailIgnoreCase(targetEmail)).isPresent();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM accounts WHERE email = ?", Integer.class, targetEmail)).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentVerificationOfOneCodeCanOnlyChangeEmailOnce() throws Exception {
        Account account = createAccount("ROLE_USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String targetEmail = "double-verify-" + UUID.randomUUID() + "@example.com";
        requestEmailChange(accessToken, targetEmail, CURRENT_PASSWORD, nextClientIp()).andExpect(status().isOk());
        String code = readLatestCode();

        var executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            var firstResult = executor.submit(() -> concurrentVerify(accessToken, code, ready, start));
            var secondResult = executor.submit(() -> concurrentVerify(accessToken, code, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            var firstResponse = firstResult.get(30, TimeUnit.SECONDS);
            var secondResponse = secondResult.get(30, TimeUnit.SECONDS);
            assertThat(List.of(firstResponse.getResponse().getStatus(), secondResponse.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200, 400);
            assertThat(accountRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(targetEmail);
            assertThat(emailChangeVerificationRepository.findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(
                    account.getId())).isEmpty();
        } finally {
            executor.shutdownNow();
        }
    }

    private void savePendingCode(Account account, String email, String code) {
        EmailChangeVerification verification = new EmailChangeVerification();
        verification.setAccount(account);
        verification.setNewEmail(email);
        verification.setCodeHash(passwordEncoder.encode(code));
        verification.setExpiresAt(LocalDateTime.now(clock).plusMinutes(10));
        emailChangeVerificationRepository.saveAndFlush(verification);
    }

    private MvcResult concurrentVerify(String token, CountDownLatch ready, CountDownLatch start) throws Exception {
        return concurrentVerify(token, "314159", ready, start);
    }

    private MvcResult concurrentVerify(String token, String code, CountDownLatch ready, CountDownLatch start)
            throws Exception {
        ready.countDown();
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        return verifyEmailChange(token, code, nextClientIp()).andReturn();
    }

    private Account createAccount(String roleCode) {
        Account account = new Account();
        account.setEmail("account-" + UUID.randomUUID() + "@example.com");
        account.setPasswordHash(passwordEncoder.encode(CURRENT_PASSWORD));
        account.setRole(roleRepository.findByCode(roleCode).orElseThrow());
        account.setEnabled(true);
        account.setEmailVerified(true);
        Account saved = accountRepository.saveAndFlush(account);
        fixtureAccountIds.add(saved.getId());
        return saved;
    }

    private MvcResult login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
    }

    private String readAccessToken(MvcResult result) throws Exception {
        return new tools.jackson.databind.ObjectMapper().readTree(result.getResponse().getContentAsString())
                .get("data").get("accessToken").asText();
    }

    private String refreshCookieValue(MvcResult result) {
        String header = result.getResponse().getHeader("Set-Cookie");
        return header.substring("refreshToken=".length(), header.indexOf(';'));
    }

    private Cookie refreshCookie(String token) {
        return new Cookie("refreshToken", token);
    }

    private org.springframework.test.web.servlet.ResultActions requestEmailChange(
            String accessToken,
            String newEmail,
            String currentPassword,
            String clientIp
    ) throws Exception {
        var builder = post(CHANGE_EMAIL_REQUEST_PATH).contentType(MediaType.APPLICATION_JSON)
                .with(request -> {
                    request.setRemoteAddr(clientIp);
                    return request;
                })
                .content(json(Map.of("newEmail", newEmail, "currentPassword", currentPassword)));
        if (!accessToken.isBlank()) builder.header("Authorization", "Bearer " + accessToken);
        return mockMvc.perform(builder);
    }

    private org.springframework.test.web.servlet.ResultActions verifyEmailChange(
            String accessToken,
            String code,
            String clientIp
    ) throws Exception {
        var builder = post(CHANGE_EMAIL_VERIFY_PATH).contentType(MediaType.APPLICATION_JSON)
                .with(request -> {
                    request.setRemoteAddr(clientIp);
                    return request;
                })
                .content(json(Map.of("code", code)));
        if (!accessToken.isBlank()) builder.header("Authorization", "Bearer " + accessToken);
        return mockMvc.perform(builder);
    }

    private EmailChangeVerification latestVerification(Integer accountId) {
        return emailChangeVerificationRepository.findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(accountId)
                .orElseThrow();
    }

    private void removePermission(String roleCode, String permissionCode) {
        jdbcTemplate.update("DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?",
                roleId(roleCode), permissionId(permissionCode));
    }

    private void addPermission(String roleCode, String permissionCode) {
        jdbcTemplate.update("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                roleId(roleCode), permissionId(permissionCode));
    }

    private Integer roleId(String roleCode) {
        return jdbcTemplate.queryForObject("SELECT id FROM roles WHERE code = ?", Integer.class, roleCode);
    }

    private Integer permissionId(String permissionCode) {
        return jdbcTemplate.queryForObject("SELECT id FROM permissions WHERE code = ?", Integer.class, permissionCode);
    }

    private String readLatestCode() {
        ArgumentCaptor<SimpleMailMessage> messageCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(javaMailSender, atLeastOnce()).send(messageCaptor.capture());
        var capturedMessages = messageCaptor.getAllValues();
        String message = capturedMessages.get(capturedMessages.size() - 1).getText();
        Matcher matcher = SIX_DIGIT_CODE.matcher(message);
        assertThat(matcher.find()).isTrue();
        return matcher.group();
    }

    private static String nextClientIp() {
        int host = CLIENT_IP_COUNTER.updateAndGet(value -> value % 200 + 1);
        return "198.51.100." + host;
    }

    private static String json(Object value) throws Exception {
        return new tools.jackson.databind.ObjectMapper().writeValueAsString(value);
    }
}
