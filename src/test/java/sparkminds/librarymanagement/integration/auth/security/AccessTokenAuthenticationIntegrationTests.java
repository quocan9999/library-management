package sparkminds.librarymanagement.integration.auth.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.RevokedAccessToken;
import sparkminds.librarymanagement.auth.entity.Role;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.repository.RevokedAccessTokenRepository;
import sparkminds.librarymanagement.auth.repository.RoleRepositoy;
import sparkminds.librarymanagement.auth.security.jwt.IssuedJwtToken;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Import(AccessTokenAuthenticationIntegrationTests.ProtectedResourceController.class)
class AccessTokenAuthenticationIntegrationTests {

    private static final String READ_RESOURCE = "/api/test/protected/read";
    private static final String CREATE_RESOURCE = "/api/test/protected/create";
    private static final String TEST_JWT_SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private RoleRepositoy roleRepository;

    @Autowired
    private RevokedAccessTokenRepository revokedAccessTokenRepository;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    void requiresAccessTokenForProtectedRequestsAndReturnsApiEnvelope() throws Exception {
        mockMvc.perform(get(READ_RESOURCE))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    @Test
    void acceptsValidAccessTokenAndEnforcesCurrentDatabasePermissions() throws Exception {
        Account user = accountRepository.findByUsername("user").orElseThrow();
        String token = issueAccessToken(user);

        request(READ_RESOURCE, token)
                .andExpect(status().isOk())
                .andExpect(content().json("{\"result\":\"read\"}"));
        request(CREATE_RESOURCE, token)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));

        Role role = roleRepository.findByCode("ROLE_USER").orElseThrow();
        role.getPermissions().removeIf(permission -> permission.getCode().equals("book:read"));
        roleRepository.saveAndFlush(role);

        request(READ_RESOURCE, token)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
    }

    @Test
    void rejectsMalformedBadSignatureExpiredAndRefreshTokens() throws Exception {
        Account user = accountRepository.findByUsername("user").orElseThrow();
        String badSignature = signedToken(user.getId(), JwtTokenType.ACCESS, Instant.now(), Instant.now().plusSeconds(60),
                Keys.hmacShaKeyFor(new byte[32]));
        String expired = signedToken(user.getId(), JwtTokenType.ACCESS, Instant.now().minusSeconds(120),
                Instant.now().minusSeconds(60), signingKey());
        IssuedJwtToken refresh = jwtTokenService.issue(user.getId(), JwtTokenType.REFRESH);

        assertTokenError("not-a-jwt", "AUTH_TOKEN_INVALID");
        assertTokenError(badSignature, "AUTH_TOKEN_INVALID");
        assertTokenError(expired, "AUTH_TOKEN_EXPIRED");
        assertTokenError(refresh.value(), "AUTH_TOKEN_INVALID");
    }

    @Test
    void rejectsRevokedTokensAndAccountsDisabledAfterIssuance() throws Exception {
        Account user = accountRepository.findByUsername("user").orElseThrow();
        IssuedJwtToken revoked = jwtTokenService.issue(user.getId(), JwtTokenType.ACCESS);
        RevokedAccessToken revocation = new RevokedAccessToken();
        revocation.setAccount(user);
        revocation.setJti(revoked.jti());
        revocation.setExpiresAt(LocalDateTime.ofInstant(revoked.expiresAt(), ZoneOffset.UTC));
        revocation.setRevokedAt(LocalDateTime.now(ZoneOffset.UTC));
        revokedAccessTokenRepository.saveAndFlush(revocation);

        request(READ_RESOURCE, revoked.value())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_TOKEN_REVOKED"));

        String validToken = issueAccessToken(user);
        user.setEnabled(false);
        accountRepository.saveAndFlush(user);
        request(READ_RESOURCE, validToken)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"));
    }

    private String issueAccessToken(Account account) {
        return jwtTokenService.issue(account.getId(), JwtTokenType.ACCESS).value();
    }

    private void assertTokenError(String token, String code) throws Exception {
        request(READ_RESOURCE, token)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(code));
    }

    private ResultActions request(String path, String token) throws Exception {
        return mockMvc.perform(get(path)
                .header("Authorization", "Bearer " + token)
                .accept(MediaType.APPLICATION_JSON));
    }

    private static String signedToken(Integer accountId, JwtTokenType type, Instant issuedAt, Instant expiresAt,
                                      SecretKey key) {
        return Jwts.builder()
                .subject(accountId.toString())
                .id(UUID.randomUUID().toString())
                .claim("type", type.name())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    private static SecretKey signingKey() {
        return Keys.hmacShaKeyFor(Base64.getDecoder().decode(TEST_JWT_SECRET));
    }

    @RestController
    @TestConfiguration
    static class ProtectedResourceController {
        @GetMapping(READ_RESOURCE)
        @PreAuthorize("hasAuthority('book:read')")
        Map<String, String> read() {
            return Map.of("result", "read");
        }

        @GetMapping(CREATE_RESOURCE)
        @PreAuthorize("hasAuthority('book:create')")
        Map<String, String> create() {
            return Map.of("result", "create");
        }
    }
}
