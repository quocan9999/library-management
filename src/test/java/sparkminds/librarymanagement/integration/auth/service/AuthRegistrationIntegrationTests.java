package sparkminds.librarymanagement.integration.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
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
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import sparkminds.librarymanagement.auth.dto.RegisterRequest;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailVerificationToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.service.RegistrationMailRequested;
import sparkminds.librarymanagement.auth.service.RegistrationService;
import sparkminds.librarymanagement.auth.service.RegistrationTransactionService;
import sparkminds.librarymanagement.auth.service.VerificationTokenService;
import sparkminds.librarymanagement.member.entity.Member;
import sparkminds.librarymanagement.member.repository.MemberRepository;
import sparkminds.librarymanagement.common.api.BusinessException;

@SpringBootTest(properties = {
        "spring.mail.password=integration-only-mail-secret",
        "app.mail.from=notifications@example.test",
        "app.frontend.base-url=http://localhost:5174"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AuthRegistrationIntegrationTests.RegistrationEventTestConfiguration.class)
@ExtendWith(OutputCaptureExtension.class)
class AuthRegistrationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RegistrationService registrationService;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private EmailVerificationTokenRepository verificationTokenRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private VerificationTokenService verificationTokenService;

    @Autowired
    private Clock clock;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RecordingRegistrationMailListener eventListener;

    @Autowired
    private TestRollbackEventPublisher rollbackEventPublisher;

    @MockitoBean
    private JavaMailSender javaMailSender;

    @Value("${spring.mail.password}")
    private String configuredSmtpPassword;

    @MockitoSpyBean
    private MemberRepository memberRepositorySpy;

    @MockitoSpyBean
    private EmailVerificationTokenRepository verificationTokenRepositorySpy;

    private final java.util.Set<String> trackedEmails = ConcurrentHashMap.newKeySet();

    @BeforeEach
    void clearRecordedEvents() {
        eventListener.clear();
    }

    @AfterEach
    void deleteOnlyRowsCreatedByThisTest() {
        for (String email : trackedEmails) {
            jdbcTemplate.update("DELETE t FROM email_verification_tokens t JOIN accounts a ON a.id = t.account_id WHERE LOWER(a.email) = LOWER(?)", email);
            jdbcTemplate.update("DELETE m FROM members m JOIN accounts a ON a.id = m.account_id WHERE LOWER(a.email) = LOWER(?)", email);
            jdbcTemplate.update("DELETE FROM accounts WHERE LOWER(email) = LOWER(?)", email);
        }
    }

    @Test
    void createsUnverifiedAccountLinkedMemberAndHashedVerificationTokenInOneRegistration() {
        String email = uniqueEmail();

        var response = registrationService.register(request(email));

        assertThat(response.email()).isEqualTo(email);
        assertThat(response.emailVerificationRequired()).isTrue();

        Account account = accountRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(account.getUsername()).isNull();
        assertThat(roleRepository.findById(account.getRole().getId()).orElseThrow().getCode()).isEqualTo("USER");
        assertThat(account.isEmailVerified()).isFalse();
        assertThat(account.isEnabled()).isTrue();
        assertThat(passwordEncoder.matches("Strong1!", account.getPasswordHash())).isTrue();

        Member member = memberRepository.findByAccountId(account.getId()).orElseThrow();
        assertThat(member.getAccount().getId()).isEqualTo(account.getId());
        assertThat(member.getMemberCode()).isEqualTo(RegistrationTransactionService.memberCodeForId(member.getId()));

        var tokens = verificationTokenRepository.findAllByAccountId(account.getId());
        assertThat(tokens).hasSize(1);
        EmailVerificationToken token = tokens.get(0);
        assertThat(token.getTokenHash()).matches("^[a-f0-9]{64}$");
        assertThat(token.getExpiresAt()).isAfter(LocalDateTime.now(clock).plusMinutes(29))
                .isBefore(LocalDateTime.now(clock).plusMinutes(31));
        assertThat(eventListener.events()).hasSize(1);
        assertThat(token.getTokenHash()).isEqualTo(verificationTokenService.hash(eventListener.events().get(0).rawToken()));
        assertThat(token.getTokenHash()).isNotEqualTo(eventListener.events().get(0).rawToken());

        var sentMessage = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(javaMailSender, times(1)).send(sentMessage.capture());
        assertThat(sentMessage.getValue().getTo()).containsExactly(email);
        assertThat(sentMessage.getValue().getFrom()).isEqualTo("notifications@example.test");
        assertThat(sentMessage.getValue().getText())
                .contains("http://localhost:5174/verify-email?token=" + eventListener.events().get(0).rawToken());
    }

    @Test
    void publicRegisterEndpointReturnsSafeCreatedResponseAndNoAuthenticationCookie() throws Exception {
        String normalizedEmail = uniqueEmail();
        trackedEmails.add(normalizedEmail);
        String suppliedEmail = "  " + normalizedEmail.toUpperCase(java.util.Locale.ROOT) + "  ";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .header("Authorization", "Bearer malformed")
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"" + suppliedEmail + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.status").value(201))
                .andExpect(jsonPath("$.code").value("REGISTER_SUCCESS"))
                .andExpect(jsonPath("$.data.email").value(normalizedEmail))
                .andExpect(jsonPath("$.data.emailVerificationRequired").value(true))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.tokenHash").doesNotExist())
                .andExpect(jsonPath("$.data.id").doesNotExist())
                .andExpect(jsonPath("$.data.role").doesNotExist())
                .andExpect(jsonPath("$.data.username").doesNotExist())
                .andReturn();

        assertThat(result.getResponse().getHeader("Set-Cookie")).isNull();
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain("rawToken", "verificationToken", eventListener.events().get(0).rawToken());
    }

    @Test
    void registrationVerificationAndLoginWorkAsOnePublicApiJourney() throws Exception {
        String email = uniqueEmail();
        trackedEmails.add(email);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("REGISTER_SUCCESS"));

        var mailEvent = eventListener.events().get(0);
        var sentMessage = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(javaMailSender, times(1)).send(sentMessage.capture());
        assertThat(sentMessage.getValue().getText())
                .contains("http://localhost:5174/verify-email?token=" + mailEvent.rawToken());

        Account account = accountRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(account.isEmailVerified()).isFalse();
        assertThat(roleRepository.findById(account.getRole().getId()).orElseThrow().getCode()).isEqualTo("USER");
        Member member = memberRepository.findByAccountId(account.getId()).orElseThrow();
        assertThat(member.getMemberCode()).matches("M[0-9]{6,}");
        var tokens = verificationTokenRepository.findAllByAccountId(account.getId());
        assertThat(tokens).hasSize(1);
        assertThat(tokens.get(0).getTokenHash()).matches("[a-f0-9]{64}")
                .isEqualTo(verificationTokenService.hash(mailEvent.rawToken()));

        MvcResult unverifiedLogin = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + email + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andReturn();
        assertThat(unverifiedLogin.getResponse().getHeader("Set-Cookie")).isNull();

        MvcResult verification = mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(APPLICATION_JSON)
                        .content("{\"token\":\"" + mailEvent.rawToken() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("EMAIL_VERIFIED"))
                .andReturn();
        assertThat(verification.getResponse().getContentAsString()).doesNotContain(mailEvent.rawToken());
        assertThat(accountRepository.findById(account.getId()).orElseThrow().isEmailVerified()).isTrue();
        assertThat(verificationTokenRepository.findByTokenHash(tokens.get(0).getTokenHash()).orElseThrow().getUsedAt())
                .isNotNull();

        MvcResult verifiedLogin = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("{\"identifier\":\"" + email + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGIN_SUCCESS"))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andReturn();
        assertThat(verifiedLogin.getResponse().getHeader("Set-Cookie")).contains("refreshToken=");
    }

    @Test
    void invalidRegistrationRequestReturnsFieldLevel422WithoutPersistence() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"bad-email\",\"password\":\"weak\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.email").isNotEmpty())
                .andExpect(jsonPath("$.errors.password").isNotEmpty());

        assertThat(eventListener.events()).isEmpty();
        assertThat(accountRepository.findByEmailIgnoreCase("bad-email")).isEmpty();
        verifyNoInteractions(javaMailSender);
    }

    @Test
    void transactionRollbackAfterPublishingRegistrationMailEventSendsNoMail() {
        assertThatThrownBy(() -> rollbackEventPublisher.publishThenFail(uniqueEmail(), "raw-test-token"))
                .isInstanceOf(IllegalStateException.class);

        assertThat(eventListener.events()).isEmpty();
        verifyNoInteractions(javaMailSender);
    }

    @Test
    void smtpFailureStillReturnsCreatedAndDoesNotLeakTokenPasswordOrSmtpSecret(CapturedOutput output) throws Exception {
        String email = uniqueEmail();
        trackedEmails.add(email);
        String smtpSecret = "fake-smtp-secret-for-log-assertion";
        doAnswer(invocation -> {
            SimpleMailMessage message = invocation.getArgument(0);
            throw new MailSendException("simulated failure: " + smtpSecret + " " + message.getText());
        }).when(javaMailSender).send(any(SimpleMailMessage.class));

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("REGISTER_SUCCESS"))
                .andReturn();

        var event = eventListener.events().get(0);
        Account account = accountRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(memberRepository.findByAccountId(account.getId())).isPresent();
        assertThat(verificationTokenRepository.findAllByAccountId(account.getId())).hasSize(1);
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain(event.rawToken(), "Strong1!", "passwordHash", "tokenHash");
        assertThat(output.toString())
                .contains("MailSendException")
                .doesNotContain(event.rawToken(), "Strong1!", configuredSmtpPassword, smtpSecret, email);
    }

    @Test
    void memberCodeUsesAtLeastSixDigitsWithoutTruncatingLargerIds() {
        assertThat(RegistrationTransactionService.memberCodeForId(1)).isEqualTo("M000001");
        assertThat(RegistrationTransactionService.memberCodeForId(25)).isEqualTo("M000025");
        assertThat(RegistrationTransactionService.memberCodeForId(1_234_567)).isEqualTo("M1234567");
        assertThat(RegistrationTransactionService.memberCodeForId(Integer.MAX_VALUE))
                .isEqualTo("M2147483647")
                .hasSizeLessThanOrEqualTo(30);
    }

    @Test
    void returnsDifferentConflictCodesForVerifiedAndUnverifiedDuplicateEmailsCaseInsensitively() throws Exception {
        String verifiedEmail = uniqueEmail();
        String pendingEmail = uniqueEmail();
        createExistingAccount(verifiedEmail.toUpperCase(java.util.Locale.ROOT), true);
        createExistingAccount(pendingEmail.toUpperCase(java.util.Locale.ROOT), false);

        assertDuplicate(verifiedEmail, "EMAIL_ALREADY_REGISTERED");
        assertDuplicate(pendingEmail, "EMAIL_NOT_VERIFIED_REGISTERED");
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"" + verifiedEmail + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"))
                .andExpect(jsonPath("$.message").value("Email này đã được đăng ký. Vui lòng đăng nhập."));
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"" + pendingEmail + "\",\"password\":\"Strong1!\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED_REGISTERED"))
                .andExpect(jsonPath("$.message").value(
                        "Email này đã đăng ký nhưng chưa được xác thực. "
                                + "Vui lòng yêu cầu gửi lại email xác thực."
                ));
        assertThat(memberCountForEmail(verifiedEmail)).isZero();
        assertThat(memberCountForEmail(pendingEmail)).isZero();
        verifyNoInteractions(javaMailSender);
    }

    @Test
    void concurrentCaseOnlyRegistrationCreatesOneAccountAndMember(CapturedOutput output) throws Exception {
        String email = uniqueEmail();
        trackedEmails.add(email);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<HttpResult> first = executor.submit(() -> registerAfterBarrier(email, ready, start));
            Future<HttpResult> second = executor.submit(() -> registerAfterBarrier(email.toUpperCase(java.util.Locale.ROOT), ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            HttpResult firstResult = first.get(20, TimeUnit.SECONDS);
            HttpResult secondResult = second.get(20, TimeUnit.SECONDS);
            var results = java.util.List.of(firstResult, secondResult);

            assertThat(results.stream().filter(result -> result.status() == 201).count()).isEqualTo(1);
            var errors = results.stream().filter(result -> result.status() == 409).collect(Collectors.toList());
            assertThat(errors).hasSize(1);
            assertThat(errors.get(0).body()).contains("EMAIL_NOT_VERIFIED_REGISTERED");

            Account account = accountRepository.findByEmailIgnoreCase(email).orElseThrow();
            assertThat(memberRepository.findByAccountId(account.getId())).isPresent();
            assertThat(accountRepository.findAll().stream().filter(row -> email.equalsIgnoreCase(row.getEmail()))).hasSize(1);
            assertThat(memberCountForEmail(email)).isEqualTo(1);
            assertThat(eventListener.events()).hasSize(1);
            verify(javaMailSender, times(1)).send(any(SimpleMailMessage.class));
            assertThat(output.toString().toLowerCase(java.util.Locale.ROOT))
                    .doesNotContain(email.toLowerCase(java.util.Locale.ROOT));
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void rollsBackAccountWhenMemberPersistenceFailsAndDoesNotPublishMail() {
        String email = uniqueEmail();
        doThrow(new IllegalStateException("injected member persistence failure"))
                .when(memberRepositorySpy).saveAndFlush(any(Member.class));

        assertThatThrownBy(() -> registrationService.register(request(email)))
                .isInstanceOf(IllegalStateException.class);

        assertThat(accountRepository.findByEmailIgnoreCase(email)).isEmpty();
        assertThat(memberCountForEmail(email)).isZero();
        assertThat(eventListener.events()).isEmpty();
        verifyNoInteractions(javaMailSender);
    }

    @Test
    void rollsBackAccountAndMemberWhenTokenPersistenceFailsAndDoesNotPublishMail() {
        String email = uniqueEmail();
        doThrow(new IllegalStateException("injected token persistence failure"))
                .when(verificationTokenRepositorySpy).saveAndFlush(any(EmailVerificationToken.class));

        assertThatThrownBy(() -> registrationService.register(request(email)))
                .isInstanceOf(IllegalStateException.class);

        assertThat(accountRepository.findByEmailIgnoreCase(email)).isEmpty();
        assertThat(tokenCountForEmail(email)).isZero();
        assertThat(memberCountForEmail(email)).isZero();
        assertThat(eventListener.events()).isEmpty();
        verifyNoInteractions(javaMailSender);
    }

    private HttpResult registerAfterBarrier(String email, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("registration barrier timed out");
        }
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"Strong1!\"}"))
                .andReturn();
        return new HttpResult(result.getResponse().getStatus(), result.getResponse().getContentAsString());
    }

    private void assertDuplicate(String email, String expectedCode) {
        assertThatThrownBy(() -> registrationService.register(request(email)))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getStatus().value()).isEqualTo(409);
                    assertThat(exception.getCode()).isEqualTo(expectedCode);
                });
    }

    private void createExistingAccount(String email, boolean verified) {
        trackedEmails.add(email);
        Account account = new Account();
        account.setEmail(email);
        account.setPasswordHash(passwordEncoder.encode("Existing1!"));
        account.setRole(roleRepository.findByCode("USER").orElseThrow());
        account.setEmailVerified(verified);
        accountRepository.saveAndFlush(account);
    }

    private RegisterRequest request(String email) {
        trackedEmails.add(email);
        return new RegisterRequest(email, "Strong1!");
    }

    private String uniqueEmail() {
        return UUID.randomUUID() + "@example.com";
    }

    private int memberCountForEmail(String email) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM members m JOIN accounts a ON a.id = m.account_id WHERE LOWER(a.email) = LOWER(?)",
                Integer.class, email);
    }

    private int tokenCountForEmail(String email) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM email_verification_tokens t JOIN accounts a ON a.id = t.account_id WHERE LOWER(a.email) = LOWER(?)",
                Integer.class, email);
    }

    @TestConfiguration
    static class RegistrationEventTestConfiguration {
        @Bean
        RecordingRegistrationMailListener recordingRegistrationMailListener() {
            return new RecordingRegistrationMailListener();
        }

        @Bean
        TestRollbackEventPublisher testRollbackEventPublisher(
                org.springframework.context.ApplicationEventPublisher eventPublisher
        ) {
            return new TestRollbackEventPublisher(eventPublisher);
        }
    }

    static class RecordingRegistrationMailListener {
        private final java.util.concurrent.CopyOnWriteArrayList<RegistrationMailRequested> recordedEvents =
                new java.util.concurrent.CopyOnWriteArrayList<>();

        @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
        public void capture(RegistrationMailRequested event) {
            recordedEvents.add(event);
        }

        void clear() {
            recordedEvents.clear();
        }

        java.util.List<RegistrationMailRequested> events() {
            return java.util.List.copyOf(recordedEvents);
        }
    }

    static class TestRollbackEventPublisher {
        private final org.springframework.context.ApplicationEventPublisher eventPublisher;

        TestRollbackEventPublisher(org.springframework.context.ApplicationEventPublisher eventPublisher) {
            this.eventPublisher = eventPublisher;
        }

        @org.springframework.transaction.annotation.Transactional
        public void publishThenFail(String email, String rawToken) {
            eventPublisher.publishEvent(new RegistrationMailRequested(email, rawToken));
            throw new IllegalStateException("rollback after event publication");
        }
    }

    private record HttpResult(int status, String body) {
    }
}
