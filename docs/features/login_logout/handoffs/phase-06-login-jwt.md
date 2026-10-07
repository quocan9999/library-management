# Handoff — Phase 6: Login and JWT issuance

## 1. Goal

Implement `POST /api/v1/auth/login` with username or email authentication, HS256 access and refresh JWTs, refresh metadata persistence, the local HttpOnly cookie policy, and the frozen API response contract.

## 2. Delivered

- Added JWT configuration from `JWT_SECRET_BASE64`; startup fails with a safe configuration error if the key is missing, invalid, or shorter than 32 bytes.
- Added HS256 token issuance and verification. Tokens contain only `sub`, `jti`, `type`, `iat`, and `exp`; verification checks signature, algorithm, token type, claims, subject, and expiry.
- Added login request validation and authentication through the Phase 5 `AuthenticationManager`.
- Normalized unknown identifier and incorrect password to `401 AUTH_INVALID_CREDENTIALS`; disabled accounts return `403 AUTH_ACCOUNT_DISABLED`.
- Persisted refresh-token JTI, account, and UTC expiry metadata. The raw refresh token is only returned through the `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, seven-day cookie.
- Added the standard success/error envelope and field-level validation errors.
- Added a test-only JWT secret in the `test` profile. Production/local configuration continues to read the secret from the ignored `.env` file or environment.

## 3. Main files

- `src/main/java/sparkminds/librarymanagement/auth/controller/AuthController.java`
- `src/main/java/sparkminds/librarymanagement/auth/service/AuthService.java`
- `src/main/java/sparkminds/librarymanagement/auth/security/jwt/JwtTokenService.java`
- `src/main/java/sparkminds/librarymanagement/common/api/ApiResponse.java`
- `src/main/java/sparkminds/librarymanagement/common/api/GlobalExceptionHandler.java`
- `src/test/java/sparkminds/librarymanagement/auth/service/AuthApiIntegrationTests.java`
- `src/test/resources/application-test.properties`

## 4. Verification

- `.\mvnw.cmd -Dtest=AuthApiIntegrationTests test` — 5 passed, 0 failures, 0 errors.
- `.\mvnw.cmd test` — 12 passed, 0 failures, 0 errors.
- Integration coverage includes admin and demo-user login, email login, common credential errors, disabled-account behavior, required field errors, token claim sets and TTLs, cookie attributes, absence of the raw refresh token from JSON, and refresh metadata persistence.
- HTTP behavior was exercised with Spring MockMvc against the configured local MySQL database. No manual Postman session was run.

## 5. Remaining work

Access-token request authentication and permission checks are Phase 7. Refresh rotation and logout are Phase 14. Frontend login and session recovery are the planned FE phases.

## 6. Commit

`feat(auth): triển khai đăng nhập và cấp JWT`
