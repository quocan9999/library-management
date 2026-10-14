package sparkminds.librarymanagement.integration.auth.service;

import org.junit.jupiter.api.Test;
import jakarta.servlet.http.Cookie;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.Permission;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.PermissionRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ChangePasswordIntegrationTests {

    private static final String PASSWORD_CHANGE_PATH = "/api/v1/profile/change-password";
    private static final String CURRENT_PASSWORD = "Current1!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void userCanChangePasswordAndAllPreviouslyIssuedSessionsRemainUsable() throws Exception {
        Account account = createAccount("USER");
        MvcResult firstLogin = login(account.getEmail(), CURRENT_PASSWORD);
        String accessTokenFirst = readAccessToken(firstLogin);
        String refreshCookieFirst = refreshCookie(firstLogin);
        MvcResult secondLogin = login(account.getEmail(), CURRENT_PASSWORD);
        String accessTokenSecond = readAccessToken(secondLogin);
        String refreshCookieSecond = refreshCookie(secondLogin);
        long originalSessionVersion = account.getSessionVersion();

        changePassword(accessTokenFirst, CURRENT_PASSWORD, "NewPass2!", "NewPass2!")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGED"));

        Account updated = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("NewPass2!", updated.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches(CURRENT_PASSWORD, updated.getPasswordHash())).isFalse();
        assertThat(updated.getSessionVersion()).isEqualTo(originalSessionVersion);

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + accessTokenFirst))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + accessTokenSecond))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(refreshCookie(refreshCookieFirst)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(refreshCookie(refreshCookieSecond)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", account.getEmail(), "password", CURRENT_PASSWORD))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", account.getEmail(), "password", "NewPass2!"))))
                .andExpect(status().isOk());
    }

    @Test
    void wrongCurrentPasswordReturns400AndLeavesPasswordAndSessionsUnchanged() throws Exception {
        Account account = createAccount("USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String originalHash = account.getPasswordHash();
        long originalSessionVersion = account.getSessionVersion();

        changePassword(accessToken, "WrongPass2!", "NewPass2!", "NewPass2!")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INVALID"));

        Account unchanged = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(unchanged.getPasswordHash()).isEqualTo(originalHash);
        assertThat(unchanged.getSessionVersion()).isEqualTo(originalSessionVersion);
    }

    @Test
    void weakMismatchedAndReusedPasswordsReturnFieldValidationWithoutUpdatingAccount() throws Exception {
        Account account = createAccount("USER");
        String accessToken = readAccessToken(login(account.getEmail(), CURRENT_PASSWORD));
        String originalHash = account.getPasswordHash();

        changePassword(accessToken, CURRENT_PASSWORD, "weak", "weak")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());
        changePassword(accessToken, CURRENT_PASSWORD, "NewPass2!", "OtherPass3!")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.confirmNewPassword").isNotEmpty());
        changePassword(accessToken, CURRENT_PASSWORD, CURRENT_PASSWORD, CURRENT_PASSWORD)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());

        assertThat(accountRepository.findById(account.getId()).orElseThrow().getPasswordHash()).isEqualTo(originalHash);
    }

    @Test
    void requiresAuthenticationButNotSpecificRoleOrProfilePermission() throws Exception {
        changePassword("", CURRENT_PASSWORD, "NewPass2!", "NewPass2!")
                .andExpect(status().isUnauthorized());

        Permission permission = permissionRepository.findByCode("account:change-password").orElseThrow();
        Role userRole = roleRepository.findByCode("USER").orElseThrow();
        userRole.getPermissions().remove(permission);
        roleRepository.saveAndFlush(userRole);
        Role adminRole = roleRepository.findByCode("ADMIN").orElseThrow();
        adminRole.getPermissions().remove(permission);
        roleRepository.saveAndFlush(adminRole);

        Account userWithoutPermission = createAccount("USER");
        String userToken = readAccessToken(login(userWithoutPermission.getEmail(), CURRENT_PASSWORD));
        changePassword(userToken, CURRENT_PASSWORD, "NewPass2!", "NewPass2!")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGED"));

        Account admin = createAccount("ADMIN");
        String adminToken = readAccessToken(login(admin.getEmail(), CURRENT_PASSWORD));
        changePassword(adminToken, CURRENT_PASSWORD, "NewPass2!", "NewPass2!")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGED"));
    }

    private Account createAccount(String roleCode) {
        Account account = new Account();
        account.setEmail(UUID.randomUUID() + "@example.com");
        account.setPasswordHash(passwordEncoder.encode(CURRENT_PASSWORD));
        account.setRole(roleRepository.findByCode(roleCode).orElseThrow());
        account.setEnabled(true);
        account.setEmailVerified(true);
        return accountRepository.saveAndFlush(account);
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

    private String refreshCookie(MvcResult result) {
        String header = result.getResponse().getHeader("Set-Cookie");
        String value = header.substring("refreshToken=".length(), header.indexOf(';'));
        return value;
    }

    private Cookie refreshCookie(String value) {
        return new Cookie("refreshToken", value);
    }

    private org.springframework.test.web.servlet.ResultActions changePassword(
            String accessToken,
            String currentPassword,
            String newPassword,
            String confirmNewPassword
    ) throws Exception {
        var builder = post(PASSWORD_CHANGE_PATH).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of(
                        "currentPassword", currentPassword,
                        "newPassword", newPassword,
                        "confirmNewPassword", confirmNewPassword
                )));
        if (!accessToken.isBlank()) builder.header("Authorization", "Bearer " + accessToken);
        return mockMvc.perform(builder);
    }

    private static String json(Object value) throws Exception {
        return new tools.jackson.databind.ObjectMapper().writeValueAsString(value);
    }
}
