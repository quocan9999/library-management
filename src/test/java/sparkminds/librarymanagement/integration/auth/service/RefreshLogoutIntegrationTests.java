package sparkminds.librarymanagement.auth.service;

import com.jayway.jsonpath.JsonPath;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.RefreshToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.RefreshTokenRepository;
import sparkminds.librarymanagement.auth.repository.RevokedAccessTokenRepository;
import sparkminds.librarymanagement.auth.security.jwt.IssuedJwtToken;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;
import sparkminds.librarymanagement.auth.security.jwt.VerifiedJwtToken;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RefreshLogoutIntegrationTests {

    private static final String BASE_PATH = "/api/v1/auth";
    private static final String TEST_JWT_SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @MockitoSpyBean
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private RevokedAccessTokenRepository revokedAccessTokenRepository;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    void refreshRotatesTokenRevokesOldMetadataAndReturnsOnlyNewAccessTokenInJson() throws Exception {
        Session session = login("user", "user");
        VerifiedJwtToken oldClaims = jwtTokenService.verify(session.refreshToken(), JwtTokenType.REFRESH);
        RefreshToken oldMetadata = refreshTokenRepository.findByJti(oldClaims.jti().toString()).orElseThrow();
        assertThat(oldMetadata.getRevokedAt()).isNull();

        MvcResult result = refresh(session.refreshToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_TOKEN_REFRESHED"))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.accessTokenExpiresIn").value(900))
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
                .andReturn();

        String accessToken = JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
        assertThat(jwtTokenService.verify(accessToken, JwtTokenType.ACCESS).accountId())
                .isEqualTo(oldClaims.accountId());
        String rotatedRefresh = cookieValue(result.getResponse().getHeader("Set-Cookie"));
        assertThat(rotatedRefresh).isNotEqualTo(session.refreshToken());
        assertCookiePolicy(result.getResponse().getHeader("Set-Cookie"), "604800");
        assertThat(result.getResponse().getContentAsString()).doesNotContain(rotatedRefresh);

        assertThat(oldMetadata.getRevokedAt()).isNotNull();
        VerifiedJwtToken newClaims = jwtTokenService.verify(rotatedRefresh, JwtTokenType.REFRESH);
        RefreshToken newMetadata = refreshTokenRepository.findByJti(newClaims.jti().toString()).orElseThrow();
        assertThat(newMetadata.getAccount().getId()).isEqualTo(oldClaims.accountId());
        assertThat(newMetadata.getRevokedAt()).isNull();

        refresh(session.refreshToken())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_REVOKED"));
        assertThat(newMetadata.getRevokedAt()).isNull();
    }

    @Test
    void refreshReturnsDistinctErrorsForMissingInvalidExpiredAndRevokedTokens() throws Exception {
        mockMvc.perform(post(BASE_PATH + "/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_MISSING"));

        refresh("malformed-token")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_INVALID"));

        Account user = accountRepository.findByUsername("user").orElseThrow();
        String expired = signedToken(user.getId(), JwtTokenType.REFRESH,
                Instant.now().minusSeconds(120), Instant.now().minusSeconds(60), signingKey());
        refresh(expired)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_EXPIRED"));

        String wrongType = jwtTokenService.issue(user.getId(), user.getSessionVersion(), JwtTokenType.ACCESS).value();
        refresh(wrongType)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_INVALID"));

        Session session = login("user", "user");
        VerifiedJwtToken claims = jwtTokenService.verify(session.refreshToken(), JwtTokenType.REFRESH);
        RefreshToken metadata = refreshTokenRepository.findByJti(claims.jti().toString()).orElseThrow();
        metadata.setRevokedAt(LocalDateTime.now(ZoneOffset.UTC));
        refreshTokenRepository.saveAndFlush(metadata);

        refresh(session.refreshToken())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_REVOKED"));
    }

    @Test
    void refreshRejectsSubjectMismatchAndDisabledAccountWithoutRotating() throws Exception {
        Account user = accountRepository.findByUsername("user").orElseThrow();
        Account admin = accountRepository.findByUsername("admin").orElseThrow();
        String jti = UUID.randomUUID().toString();
        String mismatchedToken = signedToken(admin.getId(), JwtTokenType.REFRESH,
                Instant.now(), Instant.now().plusSeconds(604800), signingKey(), jti);
        RefreshToken mismatchedMetadata = metadata(user, jti, Instant.now().plusSeconds(604800));
        refreshTokenRepository.saveAndFlush(mismatchedMetadata);

        refresh(mismatchedToken)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REFRESH_TOKEN_INVALID"));
        assertThat(mismatchedMetadata.getRevokedAt()).isNull();

        Session session = login("user", "user");
        user.setEnabled(false);
        accountRepository.saveAndFlush(user);
        refresh(session.refreshToken())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"));
        VerifiedJwtToken claims = jwtTokenService.verify(session.refreshToken(), JwtTokenType.REFRESH);
        assertThat(refreshTokenRepository.findByJti(claims.jti().toString()).orElseThrow().getRevokedAt()).isNull();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRefreshRequestsCanRotateTheSameTokenOnlyOnce() throws Exception {
        long countBefore = refreshTokenRepository.count();
        Session session = login("user", "user");
        String originalJti = jwtTokenService.verify(session.refreshToken(), JwtTokenType.REFRESH).jti().toString();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        String rotatedJti = null;
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentRefresh(session.refreshToken(), ready, start));
            Future<MvcResult> second = executor.submit(() -> concurrentRefresh(session.refreshToken(), ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            MvcResult firstResult = first.get(20, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(20, TimeUnit.SECONDS);
            assertThat(java.util.List.of(firstResult.getResponse().getStatus(), secondResult.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200, 401);
            MvcResult failed = firstResult.getResponse().getStatus() == 401 ? firstResult : secondResult;
            String errorCode = JsonPath.read(failed.getResponse().getContentAsString(), "$.code");
            assertThat(errorCode).isEqualTo("AUTH_REFRESH_TOKEN_REVOKED");
            assertThat(refreshTokenRepository.count()).isEqualTo(countBefore + 2);
            MvcResult succeeded = firstResult.getResponse().getStatus() == 200 ? firstResult : secondResult;
            rotatedJti = jwtTokenService.verify(
                    cookieValue(succeeded.getResponse().getHeader("Set-Cookie")),
                    JwtTokenType.REFRESH
            ).jti().toString();
        } finally {
            start.countDown();
            executor.shutdownNow();
            deleteRefreshToken(originalJti);
            if (rotatedJti != null) {
                deleteRefreshToken(rotatedJti);
            }
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void refreshPersistenceFailureRollsBackOldTokenRevocation() throws Exception {
        long countBefore = refreshTokenRepository.count();
        Session session = login("user", "user");
        VerifiedJwtToken claims = jwtTokenService.verify(session.refreshToken(), JwtTokenType.REFRESH);
        try {
            doThrow(new IllegalStateException("forced persistence failure"))
                    .when(refreshTokenRepository).save(any(RefreshToken.class));

            refresh(session.refreshToken()).andExpect(status().isInternalServerError());

            RefreshToken original = refreshTokenRepository.findByJti(claims.jti().toString()).orElseThrow();
            assertThat(original.getRevokedAt()).isNull();
            assertThat(refreshTokenRepository.count()).isEqualTo(countBefore + 1);
        } finally {
            deleteRefreshToken(claims.jti().toString());
        }
    }

    @Test
    void logoutRevokesBothTokensClearsCookieAndIsIdempotent() throws Exception {
        Session session = login("user", "user");
        VerifiedJwtToken accessClaims = jwtTokenService.verify(session.accessToken(), JwtTokenType.ACCESS);
        VerifiedJwtToken refreshClaims = jwtTokenService.verify(session.refreshToken(), JwtTokenType.REFRESH);

        MvcResult result = logout(session.accessToken(), session.refreshToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGOUT_SUCCESS"))
                .andReturn();
        assertCookiePolicy(result.getResponse().getHeader("Set-Cookie"), "0");
        assertThat(revokedAccessTokenRepository.existsByJti(accessClaims.jti().toString())).isTrue();
        assertThat(refreshTokenRepository.findByJti(refreshClaims.jti().toString()).orElseThrow().getRevokedAt())
                .isNotNull();

        logout(session.accessToken(), session.refreshToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGOUT_SUCCESS"));
    }

    @Test
    void logoutContinuesWithEitherValidCredentialAndIgnoresMalformedCredentials() throws Exception {
        Session noAccessToken = login("user", "user");
        logout(null, noAccessToken.refreshToken()).andExpect(status().isOk());
        VerifiedJwtToken noAccessRefresh = jwtTokenService.verify(noAccessToken.refreshToken(), JwtTokenType.REFRESH);
        assertThat(refreshTokenRepository.findByJti(noAccessRefresh.jti().toString()).orElseThrow().getRevokedAt())
                .isNotNull();

        Session expiredAccessToken = login("user", "user");
        String expiredAccess = signedToken(
                accountRepository.findByUsername("user").orElseThrow().getId(),
                JwtTokenType.ACCESS,
                Instant.now().minusSeconds(120),
                Instant.now().minusSeconds(60),
                signingKey()
        );
        logout(expiredAccess, expiredAccessToken.refreshToken()).andExpect(status().isOk());

        Session malformedAccessToken = login("user", "user");
        logout("not-a-jwt", malformedAccessToken.refreshToken()).andExpect(status().isOk());

        Session malformedRefreshToken = login("user", "user");
        VerifiedJwtToken accessClaims = jwtTokenService.verify(malformedRefreshToken.accessToken(), JwtTokenType.ACCESS);
        logout(malformedRefreshToken.accessToken(), "not-a-jwt").andExpect(status().isOk());
        assertThat(revokedAccessTokenRepository.existsByJti(accessClaims.jti().toString())).isTrue();
        VerifiedJwtToken ignoredRefresh = jwtTokenService.verify(malformedRefreshToken.refreshToken(), JwtTokenType.REFRESH);
        assertThat(refreshTokenRepository.findByJti(ignoredRefresh.jti().toString()).orElseThrow().getRevokedAt())
                .isNull();

        logout(null, null).andExpect(status().isOk()).andExpect(jsonPath("$.code").value("AUTH_LOGOUT_SUCCESS"));
    }

    @Test
    void logoutRejectsMismatchedValidAccountsWithoutRevokingEitherToken() throws Exception {
        Session user = login("user", "user");
        Session admin = login("admin", "admin");
        VerifiedJwtToken userAccess = jwtTokenService.verify(user.accessToken(), JwtTokenType.ACCESS);
        VerifiedJwtToken adminRefresh = jwtTokenService.verify(admin.refreshToken(), JwtTokenType.REFRESH);

        MvcResult result = logout(user.accessToken(), admin.refreshToken())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_TOKEN_INVALID"))
                .andReturn();

        assertCookiePolicy(result.getResponse().getHeader("Set-Cookie"), "0");
        assertThat(revokedAccessTokenRepository.existsByJti(userAccess.jti().toString())).isFalse();
        assertThat(refreshTokenRepository.findByJti(adminRefresh.jti().toString()).orElseThrow().getRevokedAt())
                .isNull();
    }

    @Test
    void disabledAccountCanStillLogout() throws Exception {
        Session session = login("user", "user");
        Account user = accountRepository.findByUsername("user").orElseThrow();
        user.setEnabled(false);
        accountRepository.saveAndFlush(user);

        MvcResult result = logout(session.accessToken(), session.refreshToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("AUTH_LOGOUT_SUCCESS"))
                .andReturn();
        assertCookiePolicy(result.getResponse().getHeader("Set-Cookie"), "0");
    }

    private Session login(String identifier, String password) throws Exception {
        String body = "{\"identifier\":\"" + identifier + "\",\"password\":\"" + password + "\"}";
        MvcResult result = mockMvc.perform(post(BASE_PATH + "/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        String accessToken = JsonPath.read(result.getResponse().getContentAsString(), "$.data.accessToken");
        return new Session(accessToken, cookieValue(result.getResponse().getHeader("Set-Cookie")));
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        var request = post(BASE_PATH + "/refresh");
        if (refreshToken != null) {
            request.cookie(new Cookie("refreshToken", refreshToken));
        }
        return mockMvc.perform(request.contentType(MediaType.APPLICATION_JSON));
    }

    private ResultActions logout(String accessToken, String refreshToken) throws Exception {
        var request = post(BASE_PATH + "/logout");
        if (accessToken != null) {
            request.header("Authorization", "Bearer " + accessToken);
        }
        if (refreshToken != null) {
            request.cookie(new Cookie("refreshToken", refreshToken));
        }
        return mockMvc.perform(request);
    }

    private MvcResult concurrentRefresh(String token, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent refresh test did not start");
        }
        return refresh(token).andReturn();
    }

    private static RefreshToken metadata(Account account, String jti, Instant expiresAt) {
        RefreshToken metadata = new RefreshToken();
        metadata.setAccount(account);
        metadata.setJti(jti);
        metadata.setExpiresAt(LocalDateTime.ofInstant(expiresAt, ZoneOffset.UTC));
        return metadata;
    }

    private static String signedToken(Integer accountId, JwtTokenType type, Instant issuedAt, Instant expiresAt,
                                      SecretKey key) {
        return signedToken(accountId, type, issuedAt, expiresAt, key, UUID.randomUUID().toString());
    }

    private static String signedToken(Integer accountId, JwtTokenType type, Instant issuedAt, Instant expiresAt,
                                      SecretKey key, String jti) {
        return Jwts.builder()
                .subject(accountId.toString())
                .id(jti)
                .claim("type", type.name())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    private static SecretKey signingKey() {
        return Keys.hmacShaKeyFor(Base64.getDecoder().decode(TEST_JWT_SECRET));
    }

    private static String cookieValue(String header) {
        assertThat(header).isNotBlank().startsWith("refreshToken=");
        int delimiter = header.indexOf(';');
        return header.substring("refreshToken=".length(), delimiter < 0 ? header.length() : delimiter);
    }

    private void deleteRefreshToken(String jti) {
        refreshTokenRepository.findByJti(jti).ifPresent(refreshTokenRepository::delete);
    }

    private static void assertCookiePolicy(String header, String maxAge) {
        assertThat(header)
                .startsWith("refreshToken=")
                .contains("HttpOnly")
                .contains("SameSite=Strict")
                .contains("Path=/api/v1/auth")
                .contains("Max-Age=" + maxAge)
                .doesNotContain("; Secure")
                .doesNotContain("Domain=");
    }

    private record Session(String accessToken, String refreshToken) {
    }
}
