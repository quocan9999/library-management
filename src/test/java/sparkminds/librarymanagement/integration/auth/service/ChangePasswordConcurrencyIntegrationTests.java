package sparkminds.librarymanagement.integration.auth.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChangePasswordConcurrencyIntegrationTests {

    private static final String CURRENT_PASSWORD = "Current1!";
    private static final String CHANGE_PASSWORD_PATH = "/api/v1/profile/change-password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    private Account account;
    private String accessToken;

    @BeforeEach
    void createAccount() {
        account = new Account();
        account.setEmail(UUID.randomUUID() + "@example.com");
        account.setPasswordHash(passwordEncoder.encode(CURRENT_PASSWORD));
        account.setRole(roleRepository.findByCode("USER").orElseThrow());
        account.setEnabled(true);
        account.setEmailVerified(true);
        account = accountRepository.saveAndFlush(account);
        accessToken = jwtTokenService.issue(account.getId(), account.getSessionVersion(), JwtTokenType.ACCESS).value();
    }

    @AfterEach
    void removeAccount() {
        if (account != null) accountRepository.deleteById(account.getId());
    }

    @Test
    void concurrentChangesWithTheSameCurrentPasswordAllowOnlyOneCommit() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = executor.submit(() -> changePassword("FirstPass2!", ready, start));
            Future<Integer> second = executor.submit(() -> changePassword("SecondPass3!", ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<Integer> statuses = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(200, 400);

            Account updated = accountRepository.findById(account.getId()).orElseThrow();
            assertThat(updated.getSessionVersion()).isZero();
            assertThat(passwordEncoder.matches("FirstPass2!", updated.getPasswordHash())
                    || passwordEncoder.matches("SecondPass3!", updated.getPasswordHash())).isTrue();
        } finally {
            executor.shutdownNow();
        }
    }

    private int changePassword(String newPassword, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("change password barrier timed out");
        String body = new tools.jackson.databind.ObjectMapper().writeValueAsString(java.util.Map.of(
                "currentPassword", CURRENT_PASSWORD,
                "newPassword", newPassword,
                "confirmNewPassword", newPassword
        ));
        return mockMvc.perform(post(CHANGE_PASSWORD_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getStatus();
    }
}
