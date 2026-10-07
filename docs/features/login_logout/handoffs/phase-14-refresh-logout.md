# Handoff — Phase 14: Refresh rotation and logout

## 1. Goal

Complete the token lifecycle before frontend integration: atomically rotate refresh tokens, enforce single-use concurrency, and implement idempotent logout with the frozen credential rules.

## 2. Delivered

- Added a JPA `PESSIMISTIC_WRITE` lookup for refresh-token JTI and kept validation, old-token revocation, new-token issuance, and metadata persistence in one transaction.
- Refresh validates signature, expiry, `REFRESH` type, JTI metadata, revoked state, database expiry, token subject/account consistency, account existence, and enabled state.
- Rotation sets `revoked_at` on the old record and persists only new-token metadata. Reuse returns `401 AUTH_REFRESH_TOKEN_REVOKED`; a concurrent integration test proves one request succeeds and one is rejected.
- Added idempotent logout. Access and refresh credentials are optional; expired or malformed credentials are ignored while valid remaining credentials are revoked. Disabled accounts can still log out.
- Logout validates cross-token account consistency before writes. A valid mismatch returns `401 AUTH_TOKEN_INVALID`, revokes neither token, and clears the refresh cookie.
- Centralized cookie creation and clearing. The logout cookie matches the original name/path and uses `Max-Age=0`.
- Added integration coverage for persistence rollback; the previous refresh record stays active when saving the rotated metadata fails.

## 3. Main files

- `src/main/java/sparkminds/librarymanagement/auth/service/AuthSessionService.java`
- `src/main/java/sparkminds/librarymanagement/auth/service/RefreshCookieFactory.java`
- `src/main/java/sparkminds/librarymanagement/auth/controller/AuthSessionController.java`
- `src/main/java/sparkminds/librarymanagement/auth/repository/RefreshTokenRepository.java`
- `src/test/java/sparkminds/librarymanagement/auth/service/RefreshLogoutIntegrationTests.java`

## 4. Verification

- `.\mvnw.cmd -Dtest=RefreshLogoutIntegrationTests test` — 9 passed, 0 failures, 0 errors.
- `.\mvnw.cmd test` — 25 passed, 0 failures, 0 errors.
- Coverage includes successful rotation, reuse, missing/invalid/expired/revoked tokens, subject mismatch, disabled-account handling, simultaneous refresh, rollback, both-token logout, one-token logout, malformed credentials, repeated logout, account mismatch, and cookie clearing.
- The phase began red against the missing refresh/logout routes. All phase checks passed after implementation.
- Removed the five refresh-token rows created by the earlier non-transactional RED/initial concurrency runs; the database table is empty after verification.

## 5. Remaining work

Frontend phases FE-01 and FE-02 will connect login, session restoration/refresh, retry, and logout to these APIs. Final backend/frontend integration remains after those phases.

## 6. Commit

`feat(auth): hoàn thiện refresh token và logout`
