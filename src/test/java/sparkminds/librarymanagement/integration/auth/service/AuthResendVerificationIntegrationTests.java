package sparkminds.librarymanagement.integration.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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
import java.util.concurrent.TimeoutException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailVerificationToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.service.RegistrationService;
import sparkminds.librarymanagement.auth.service.VerificationTokenService;

@SpringBootTest(properties = {
        "spring.mail.password=integration-only-mail-secret",
        "app.mail.from=notifications@example.test",
        "app.frontend.base-url=http://localhost:5174"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AuthResendVerificationIntegrationTests.ResendClockConfiguration.class)
class AuthResendVerificationIntegrationTests {

    private static final Instant TEST_INSTANT = Instant.parse("2026-10-11T12:00:00Z");
    private static final AtomicInteger NEXT_TEST_IP = new AtomicInteger(1);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

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
    private RegistrationService registrationService;

    @MockitoBean
    private JavaMailSender javaMailSender;

    private final java.util.Set<String> testEmails = java.util.concurrent.ConcurrentHashMap.newKeySet();

    @AfterEach
    void removeOnlyRowsCreatedByThisTest() {
        for (String email : testEmails) {
            jdbcTemplate.update("DELETE t FROM email_verification_tokens t JOIN accounts a ON a.id = t.account_id WHERE LOWER(a.email) = LOWER(?)", email);
            jdbcTemplate.update("DELETE m FROM members m JOIN accounts a ON a.id = m.account_id WHERE LOWER(a.email) = LOWER(?)", email);
            jdbcTemplate.update("DELETE FROM accounts WHERE LOWER(email) = LOWER(?)", email);
        }
    }

    @Test
    void returnsIdenticalGenericResponseForUnknownVerifiedAndUnverifiedAccounts() throws Exception {
        String verifiedEmail = uniqueEmail();
        Account verified = createAccount(verifiedEmail, true);
        String unverifiedEmail = uniqueEmail();
        Account unverified = createAccount(unverifiedEmail, false);
        createToken(unverified, LocalDateTime.ofInstant(TEST_INSTANT.plusSeconds(1800), ZoneOffset.UTC));

        JsonNode unknownResponse = body(resend(uniqueEmail(), uniqueRemoteAddress()));
        JsonNode verifiedResponse = body(resend(verifiedEmail, uniqueRemoteAddress()));
        JsonNode unverifiedResponse = body(resend(unverifiedEmail, uniqueRemoteAddress()));

        assertThat(unknownResponse.get("success")).isEqualTo(verifiedResponse.get("success"));
        assertThat(unknownResponse.get("status")).isEqualTo(verifiedResponse.get("status"));
        assertThat(unknownResponse.get("code")).isEqualTo(verifiedResponse.get("code"));
        assertThat(unknownResponse.get("message")).isEqualTo(verifiedResponse.get("message"));
        assertThat(unknownResponse.get("data")).isEqualTo(verifiedResponse.get("data"));
        assertThat(unknownResponse.get("success")).isEqualTo(unverifiedResponse.get("success"));
        assertThat(unknownResponse.get("status")).isEqualTo(unverifiedResponse.get("status"));
        assertThat(unknownResponse.get("code")).isEqualTo(unverifiedResponse.get("code"));
        assertThat(unknownResponse.get("message")).isEqualTo(unverifiedResponse.get("message"));
        assertThat(unknownResponse.get("data")).isEqualTo(unverifiedResponse.get("data"));
        assertThat(unknownResponse.get("data").isNull()).isTrue();
        assertThat(tokenRepository.findAllByAccountId(verified.getId())).isEmpty();
        assertThat(tokenRepository.findAllByAccountId(unverified.getId())).hasSize(2);
        verify(javaMailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    void countsInvalidBodiesTowardTheIpLimitAndReturnsPositiveRetryAfter() throws Exception {
        String address = uniqueRemoteAddress();
        for (int index = 0; index < 9; index++) {
            resend(uniqueEmail(), address).andExpect(status().isOk());
        }
        mockMvc.perform(post("/api/v1/auth/resend-verification")
                        .with(request -> {
                            request.setRemoteAddr(address);
                            return request;
                        })
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        MvcResult limited = mockMvc.perform(post("/api/v1/auth/resend-verification")
                        .with(request -> {
                            request.setRemoteAddr(address);
                            return request;
                        })
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"" + uniqueEmail() + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RESEND_RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"))
                .andReturn();

        long retryAfter = Long.parseLong(limited.getResponse().getHeader("Retry-After"));
        assertThat(retryAfter).isPositive();
    }

    @Test
    void malformedAuthorizationDoesNotBlockPublicRoutesOrBypassResendIpAccounting() throws Exception {
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .header("Authorization", "Bearer malformed")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"unknown-token\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_INVALID"));

        String address = uniqueRemoteAddress();
        for (int index = 0; index < 10; index++) {
            resend(uniqueEmail(), address, "Bearer malformed")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value("VERIFICATION_EMAIL_REQUESTED"));
        }
        resend(uniqueEmail(), address, "Bearer malformed")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RESEND_RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void successfulRegistrationEmailConsumesTheSameEmailCooldownAsResend() throws Exception {
        String email = uniqueEmail();
        testEmails.add(email);
        registrationService.register(new RegisterRequest(email, "Strong1!"));

        resend(email, uniqueRemoteAddress())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(javaMailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    void smtpFailureKeepsPreviousTokenCurrentAndStillReturnsGenericSuccess() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, false);
        VerificationTokenService.IssuedToken oldToken = createToken(
                account, LocalDateTime.ofInstant(TEST_INSTANT.plusSeconds(1800), ZoneOffset.UTC));
        doThrow(new MailSendException("simulated private transport detail"))
                .when(javaMailSender).send(any(SimpleMailMessage.class));

        MvcResult result = resend(email, uniqueRemoteAddress()).andExpect(status().isOk()).andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain(email, oldToken.rawToken());
        assertThat(tokenRepository.findAllByAccountId(account.getId()))
                .extracting(EmailVerificationToken::getId)
                .containsExactly(oldToken.token().getId());
        assertThat(tokenRepository.findByTokenHash(tokenService.hash(oldToken.rawToken()))).isPresent();
    }

    @Test
    void successfulResendMakesCandidateTokenCurrentAndSupersedesPreviousToken() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, false);
        VerificationTokenService.IssuedToken oldToken = createToken(
                account, LocalDateTime.ofInstant(TEST_INSTANT.plusSeconds(1800), ZoneOffset.UTC));

        MvcResult result = resend(email, uniqueRemoteAddress()).andExpect(status().isOk()).andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain(email, oldToken.rawToken());
        var tokens = tokenRepository.findAllByAccountId(account.getId());
        assertThat(tokens).hasSize(2);
        assertThat(tokens.get(1).getId()).isGreaterThan(tokens.get(0).getId());
        assertThat(tokens.get(0).getUsedAt()).isNull();
    }

    @Test
    void concurrentResendsForTheSameEmailOnlySendOneMessage() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, false);
        createToken(account, LocalDateTime.ofInstant(TEST_INSTANT.plusSeconds(1800), ZoneOffset.UTC));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = executor.submit(() -> resendAfterBarrier(email, uniqueRemoteAddress(), ready, start));
            Future<Integer> second = executor.submit(() -> resendAfterBarrier(email, uniqueRemoteAddress(), ready, start));
            assertThat(ready.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(first.get(20, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(second.get(20, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(tokenRepository.findAllByAccountId(account.getId())).hasSize(2);
            verify(javaMailSender, times(1)).send(any(SimpleMailMessage.class));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void verificationWaitsUntilAnInProgressResendEitherCommitsOrCompensates() throws Exception {
        String email = uniqueEmail();
        Account account = createAccount(email, false);
        VerificationTokenService.IssuedToken currentToken = createToken(
                account, LocalDateTime.ofInstant(TEST_INSTANT.plusSeconds(1800), ZoneOffset.UTC));
        CountDownLatch mailStarted = new CountDownLatch(1);
        CountDownLatch finishMail = new CountDownLatch(1);
        doAnswer(invocation -> {
            mailStarted.countDown();
            if (!finishMail.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new IllegalStateException("mock SMTP barrier timed out");
            }
            throw new MailSendException("simulated resend failure after wait");
        }).when(javaMailSender).send(any(SimpleMailMessage.class));
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> resend = executor.submit(
                    () -> resend(email, uniqueRemoteAddress()).andReturn().getResponse().getStatus());
            assertThat(mailStarted.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            Future<Integer> verification = executor.submit(() -> mockMvc.perform(post("/api/v1/auth/verify-email")
                            .contentType(APPLICATION_JSON)
                            .content("{\"token\":\"" + currentToken.rawToken() + "\"}"))
                    .andReturn().getResponse().getStatus());
            assertThatThrownBy(() -> verification.get(1, java.util.concurrent.TimeUnit.SECONDS))
                    .isInstanceOf(TimeoutException.class);
            finishMail.countDown();
            assertThat(resend.get(10, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(verification.get(10, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
        } finally {
            finishMail.countDown();
            executor.shutdownNow();
        }
    }

    private int resendAfterBarrier(
            String email,
            String address,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
            throw new IllegalStateException("resend barrier timed out");
        }
        return resend(email, address).andReturn().getResponse().getStatus();
    }

    private org.springframework.test.web.servlet.ResultActions resend(String email, String address) throws Exception {
        return resend(email, address, null);
    }

    private org.springframework.test.web.servlet.ResultActions resend(
            String email,
            String address,
            String authorization
    ) throws Exception {
        var request = post("/api/v1/auth/resend-verification").with(builder -> {
            builder.setRemoteAddr(address);
            return builder;
        });
        if (authorization != null) {
            request.header("Authorization", authorization);
        }
        return mockMvc.perform(request
                .contentType(APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"));
    }

    private JsonNode body(org.springframework.test.web.servlet.ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private Account createAccount(String email, boolean verified) {
        testEmails.add(email);
        Account account = new Account();
        account.setEmail(email);
        account.setPasswordHash(passwordEncoder.encode("Existing1!"));
        account.setRole(roleRepository.findByCode("ROLE_USER").orElseThrow());
        account.setEnabled(true);
        account.setEmailVerified(verified);
        return accountRepository.saveAndFlush(account);
    }

    private VerificationTokenService.IssuedToken createToken(Account account, LocalDateTime expiresAt) {
        VerificationTokenService.IssuedToken issued = tokenService.issue(account);
        issued.token().setExpiresAt(expiresAt);
        tokenRepository.saveAndFlush(issued.token());
        return issued;
    }

    private String uniqueEmail() {
        return UUID.randomUUID() + "@example.com";
    }

    private String uniqueRemoteAddress() {
        return "203.0.113." + NEXT_TEST_IP.getAndIncrement();
    }

    @TestConfiguration
    static class ResendClockConfiguration {
        @Bean
        @org.springframework.context.annotation.Primary
        Clock resendTestClock() {
            return Clock.fixed(TEST_INSTANT, ZoneOffset.UTC);
        }
    }
}
