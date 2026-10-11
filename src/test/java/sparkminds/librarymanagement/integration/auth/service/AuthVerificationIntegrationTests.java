package sparkminds.librarymanagement.integration.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailVerificationToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.service.VerificationTokenService;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AuthVerificationIntegrationTests.VerificationClockConfiguration.class)
class AuthVerificationIntegrationTests {

    private static final Instant TEST_INSTANT = Instant.parse("2026-10-11T12:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private EmailVerificationTokenRepository tokenRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private VerificationTokenService tokenService;

    @Autowired
    private Clock clock;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private JavaMailSender javaMailSender;

    private final java.util.Set<String> testEmails = java.util.concurrent.ConcurrentHashMap.newKeySet();

    @AfterEach
    void removeOnlyRowsCreatedByThisTest() {
        for (String email : testEmails) {
            jdbcTemplate.update(
                    "DELETE t FROM email_verification_tokens t JOIN accounts a ON a.id = t.account_id WHERE LOWER(a.email) = LOWER(?)",
                    email
            );
            jdbcTemplate.update("DELETE FROM accounts WHERE LOWER(email) = LOWER(?)", email);
        }
    }

    @Test
    void verifiesValidTokenOnceWithoutReturningTokenOrCreatingAuthentication() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email);
        VerificationTokenService.IssuedToken issued = createToken(account, now().plusMinutes(30), null);

        MvcResult first = verify(issued.rawToken());

        assertThat(first.getResponse().getStatus()).isEqualTo(200);
        assertThat(first.getResponse().getContentAsString()).contains("EMAIL_VERIFIED");
        assertThat(first.getResponse().getContentAsString()).doesNotContain(issued.rawToken(), email, "accessToken", "refreshToken");
        assertThat(first.getResponse().getCookie("refreshToken")).isNull();
        assertThat(first.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
        Account verifiedAccount = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(verifiedAccount.isEmailVerified()).isTrue();
        EmailVerificationToken usedToken = tokenRepository.findByTokenHash(tokenService.hash(issued.rawToken())).orElseThrow();
        assertThat(usedToken.getUsedAt()).isEqualTo(now());

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + issued.rawToken() + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_USED"))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    void rejectsUnknownTokenWithoutDisclosingAccountDetails() throws Exception {
        String unknownToken = "not-a-stored-verification-token";

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + unknownToken + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_INVALID"))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    void prioritizesUsedThenExpiredThenSupersededTokenStatus() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email);
        VerificationTokenService.IssuedToken usedExpired = createToken(account, now().minusSeconds(1), now().minusMinutes(1));
        createToken(account, now().plusMinutes(30), null);

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + usedExpired.rawToken() + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_USED"));
    }

    @Test
    void treatsTokenAtExactExpiryInstantAsExpiredBeforeSupersededCheck() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email);
        VerificationTokenService.IssuedToken expired = createToken(account, now(), null);
        createToken(account, now().plusMinutes(30), null);

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + expired.rawToken() + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_EXPIRED"));
    }

    @Test
    void returnsRevokedForUnusedTokenSupersededByNewerTokenId() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email);
        VerificationTokenService.IssuedToken oldToken = createToken(account, now().plusMinutes(30), null);
        createToken(account, now().plusMinutes(30), null);

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + oldToken.rawToken() + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_REVOKED"));
    }

    @Test
    void concurrentVerificationAllowsExactlyOneRequestToConsumeToken() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email);
        VerificationTokenService.IssuedToken issued = createToken(account, now().plusMinutes(30), null);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = executor.submit(() -> verifyAfterBarrier(issued.rawToken(), ready, start));
            Future<Integer> second = executor.submit(() -> verifyAfterBarrier(issued.rawToken(), ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            var statuses = java.util.List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
            assertThat(statuses.stream().filter(status -> status == 200).toList())
                    .as("Concurrent verify HTTP statuses were %s", statuses)
                    .hasSize(1);
            assertThat(statuses.stream().filter(status -> status == 400).count()).isEqualTo(1);
            assertThat(accountRepository.findById(account.getId()).orElseThrow().isEmailVerified()).isTrue();
            assertThat(tokenRepository.findByTokenHash(tokenService.hash(issued.rawToken())).orElseThrow().getUsedAt())
                    .isEqualTo(now());
        } finally {
            executor.shutdownNow();
        }
    }

    private int verifyAfterBarrier(String token, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("verification barrier timed out");
        }
        return verify(token).getResponse().getStatus();
    }

    private MvcResult verify(String rawToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + rawToken + "\"}"))
                .andReturn();
    }

    private Account createAccount(String email) {
        testEmails.add(email);
        Account account = new Account();
        account.setEmail(email);
        account.setPasswordHash(passwordEncoder.encode("Existing1!"));
        account.setRole(roleRepository.findByCode("ROLE_USER").orElseThrow());
        account.setEnabled(true);
        account.setEmailVerified(false);
        return accountRepository.saveAndFlush(account);
    }

    private VerificationTokenService.IssuedToken createToken(
            Account account,
            LocalDateTime expiresAt,
            LocalDateTime usedAt
    ) {
        VerificationTokenService.IssuedToken issued = tokenService.issue(account);
        issued.token().setExpiresAt(expiresAt);
        issued.token().setUsedAt(usedAt);
        tokenRepository.saveAndFlush(issued.token());
        return issued;
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private String uniqueEmail() {
        return UUID.randomUUID() + "@example.com";
    }

    @TestConfiguration
    static class VerificationClockConfiguration {
        @Bean
        @org.springframework.context.annotation.Primary
        Clock verificationTestClock() {
            return Clock.fixed(TEST_INSTANT, ZoneOffset.UTC);
        }
    }
}
