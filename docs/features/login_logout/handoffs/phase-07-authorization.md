# Handoff — Phase 7: JWT authentication and permissions

## 1. Goal

Authenticate protected API requests from access JWTs, check current account and permission state in the database, and return the frozen JSON error envelope for authentication and authorization failures.

## 2. Delivered

- Added a stateless bearer-token filter. Login, refresh, and logout paths skip mandatory access-token validation so their business handlers can apply their own rules.
- Added JWT verification outcomes for malformed/signature-invalid/wrong-type, expired, and revoked access tokens.
- Loads the account, enabled state, role, and permissions from the database on each protected request. Disabled accounts and permission changes take effect immediately.
- Added `@EnableMethodSecurity` and standard JSON handlers for required/invalid/expired/revoked/disabled authentication and denied permissions.
- Kept the permission test endpoints inside the integration-test source; no placeholder business endpoint was added to production.

## 3. Main files

- `src/main/java/sparkminds/librarymanagement/auth/security/JwtAuthenticationFilter.java`
- `src/main/java/sparkminds/librarymanagement/auth/security/AccessTokenAuthenticationService.java`
- `src/main/java/sparkminds/librarymanagement/config/ApiAuthenticationEntryPoint.java`
- `src/main/java/sparkminds/librarymanagement/config/ApiAccessDeniedHandler.java`
- `src/main/java/sparkminds/librarymanagement/config/SecurityConfig.java`
- `src/test/java/sparkminds/librarymanagement/auth/security/AccessTokenAuthenticationIntegrationTests.java`

## 4. Verification

- `.\mvnw.cmd -Dtest=AccessTokenAuthenticationIntegrationTests test` — 4 passed, 0 failures, 0 errors.
- `.\mvnw.cmd test` — 16 passed, 0 failures, 0 errors.
- Tests cover no token, valid access token, malformed JWT, bad signature, expiry, refresh token presented as access, revoked JTI, disabled account after token issuance, a permission success/denial, and a permission removed from the database between requests.
- The phase began red: all four test methods failed against the prior stateless-but-unfiltered chain. After implementation, the focused and full suites passed.

## 5. Remaining work

Refresh-token rotation and logout are Phase 14. Frontend login, refresh-on-reload, request retry, and logout are the planned FE phases.

## 6. Commit

`feat(auth): bảo vệ API bằng JWT và permission`
