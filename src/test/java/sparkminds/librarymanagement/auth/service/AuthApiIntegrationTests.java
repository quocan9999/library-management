package sparkminds.librarymanagement.auth.service;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.RefreshToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Test
    void loginIssuesExactAccessClaimsAndStoresRefreshMetadataOnlyInCookie() throws Exception {
        MvcResult result = login("admin", "admin")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGIN_SUCCESS"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.accessTokenExpiresIn").value(900))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
                .andReturn();

        String accessToken = JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
        Map<String, Object> accessClaims = claims(accessToken);
        assertClaimSet(accessClaims);
        assertThat((String) accessClaims.get("sub"))
                .isEqualTo(accountRepository.findByUsername("admin").orElseThrow().getId().toString());
        assertThat((String) accessClaims.get("type")).isEqualTo("ACCESS");
        assertThat(((Number) accessClaims.get("exp")).longValue() - ((Number) accessClaims.get("iat")).longValue())
                .isEqualTo(900);

        String cookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(cookie).isNotNull()
                .contains("refreshToken=")
                .contains("HttpOnly")
                .contains("SameSite=Strict")
                .contains("Path=/api/v1/auth")
                .contains("Max-Age=604800")
                .doesNotContain("; Secure")
                .doesNotContain("Domain=");

        String refreshToken = cookie.substring("refreshToken=".length(), cookie.indexOf(';'));
        Map<String, Object> refreshClaims = claims(refreshToken);
        assertClaimSet(refreshClaims);
        assertThat((String) refreshClaims.get("type")).isEqualTo("REFRESH");
        assertThat(((Number) refreshClaims.get("exp")).longValue() - ((Number) refreshClaims.get("iat")).longValue())
                .isEqualTo(604800);
        RefreshToken metadata = refreshTokenRepository.findByJti((String) refreshClaims.get("jti")).orElseThrow();
        assertThat(metadata.getAccount().getId()).isEqualTo(accountRepository.findByUsername("admin").orElseThrow().getId());
        assertThat(result.getResponse().getContentAsString()).doesNotContain(refreshToken);
    }

    @Test
    void loginWorksForDemoUserByUsernameAndEmail() throws Exception {
        login("user", "user")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGIN_SUCCESS"));

        login("user@gmail.com", "user")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGIN_SUCCESS"));
    }

    @Test
    void unknownIdentifierAndWrongPasswordUseTheSameCredentialError() throws Exception {
        login("admin", "wrong-password")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_INVALID_CREDENTIALS"));

        login("unknown-account", "wrong-password")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_INVALID_CREDENTIALS"));
    }

    @Test
    void blankCredentialsReturnContractValidationErrors() throws Exception {
        login("", "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.identifier").isNotEmpty())
                .andExpect(jsonPath("$.errors.password").isNotEmpty());
    }

    @Test
    void disabledAccountReturnsForbiddenWithoutIssuingCookie() throws Exception {
        Account admin = accountRepository.findByUsername("admin").orElseThrow();
        admin.setEnabled(false);
        accountRepository.saveAndFlush(admin);

        MvcResult result = login("admin", "admin")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"))
                .andReturn();

        assertThat(result.getResponse().getHeader("Set-Cookie")).isNull();
    }

    private ResultActions login(String identifier, String password) throws Exception {
        String body = "{\"identifier\":\"" + identifier + "\",\"password\":\"" + password + "\"}";
        return mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private Map<String, Object> claims(String token) {
        String[] parts = token.split("\\.");
        assertThat(parts).hasSize(3);
        byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
        return JsonPath.read(new String(payload, StandardCharsets.UTF_8), "$" );
    }

    private void assertClaimSet(Map<String, Object> claims) {
        Set<String> names = new HashSet<>(claims.keySet());
        assertThat(names).containsExactlyInAnyOrder("sub", "jti", "type", "iat", "exp");
        assertThat((String) claims.get("jti")).isNotBlank();
    }
}
