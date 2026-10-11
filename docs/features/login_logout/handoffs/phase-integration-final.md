# Handoff — Login/Refresh/Logout integration

## 1. Goal

Verify the backend and frontend as one login, session-restore, refresh, and logout feature against the frozen API contract.

## 2. Backend status

- Spring Security is stateless, BCrypt-backed, and loads account, role, and permission data from the database.
- Login supports username or email and returns the access token in the API envelope while setting the refresh token only as an HttpOnly cookie.
- Access-token authorization checks expiry, signature, account state, revocation, and current database permissions. The contract's 401/403 responses are covered by integration tests.
- Refresh rotates tokens atomically under a pessimistic lock. Reuse, concurrent requests, rollback, invalid tokens, and disabled-account behavior are covered by backend tests.
- Logout is idempotent, revokes available credentials, and clears the refresh cookie.
- Liquibase is current at 20 changesets; the full suite reported no pending migrations.

## 3. Frontend status

- `/login` follows `DESIGN.md`; username/email and password validation, loading, invalid-credential, disabled-account, network, and unexpected-server messages are implemented.
- Access tokens remain in an in-memory store synchronized with React. Refresh tokens stay in the browser-managed HttpOnly cookie.
- Startup restore delays route decisions until the refresh-cookie request completes. `AUTH_TOKEN_EXPIRED` is the only response code that triggers one shared refresh and one retry per protected request.
- `/` is protected and keeps `Hello Library Management` as its main content. Admin and member accounts share this route.
- The minimal Sign out action clears local auth state even if the logout request fails.

## 4. Automated verification

- `.\mvnw.cmd test` — 25 passed, 0 failures, 0 errors.
- `npm ci` — completed from the lockfile; 0 vulnerabilities reported.
- `npm test` — 7 passed, 0 failed.
- `npm run lint` — passed.
- `npm run build` — passed with TypeScript 6.0.3 and Vite 8.3.3.
- Newman 6.2.2 — 8 requests, 17 assertions, 0 failures. See `docs/features/login_logout/postman/README.md` and the v2.1 collection.

The build still reports Vite's advisory for a 683.62 kB minified JavaScript chunk (223.24 kB gzip). It does not fail the production build.

## 5. Browser and cross-origin verification

- Chrome DevTools used the frontend at `http://localhost:5173` and backend at `http://localhost:8081`.
- `admin/admin`, `user/user`, and `user@gmail.com/user` reached `/` and displayed the same greeting. Invalid credentials displayed the normalized message after a 401.
- With a valid refresh cookie, reloading restored the protected page after one `POST /api/v1/auth/refresh` response of 200. With no cookie, refresh returned 401 and the route stayed at `/login`.
- Clicking Sign out called logout successfully and returned to `/login`. Repeated logout without credentials returned 200.
- Browser storage key lists stayed empty. `document.cookie` did not expose the refresh cookie.
- Newman verified the frontend origin's CORS preflight, credential allowance, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, local `Secure=false`, seven-day max age, rotation, and clearing with `Max-Age=0`.
- Chrome DevTools checked the login and home layouts at desktop, 375 × 812, 390 × 844, and 844 × 390 landscape sizes; no horizontal overflow was present. The Ant Design 6 Alert deprecation was fixed and the invalid-credential state was rechecked.

## 6. Postman status

No Postman desktop or CLI executable was installed in the workspace. The checked-in Postman v2.1 collection was run with Newman, the official collection runner. It covers CORS preflight, invalid credentials, both demo accounts, refresh rotation, cookie policy, logout with both credentials, cookie clearing, and credential-free idempotent logout. Maven integration tests cover the remaining API cases, including JWT claims, 401/403, permission reload, disabled account, refresh reuse, concurrency, and rollback.

## 7. Documentation review

Reviewed the API contract, JWT configuration, cookie/CORS/CSRF rules, refresh rotation and logout strategies, login/logout sequences, implementation plan, and all phase handoffs. The implementation and local cookie behavior match those documents. The Newman collection and its run command are included under `docs/features/login_logout/postman/`.

## 8. Known limitations

- The backend currently exposes no protected business resource endpoint. The frontend's expired-access interceptor is therefore covered with deterministic Axios-adapter tests, while backend authorization is covered by Spring integration tests.
- The disabled-account UI copy is mapped to `AUTH_ACCOUNT_DISABLED`, and backend tests cover that response; a disabled account was not toggled in the live browser.
- Chrome Offline emulation disconnected the page before its network-error form state could be submitted. The frontend maps network failures to recovery copy, but that state was not manually verified in the browser.
- The Vite bundle-size advisory remains.

## 9. Phase commits

- Phase 5 — `8515b17 feat(security): hoàn thiện nền tảng Spring Security`
- Phase 6 — `7e160ca feat(auth): triển khai đăng nhập và cấp JWT`
- Phase 7 — `e5b066c feat(auth): bảo vệ API bằng JWT và permission`
- Phase 14 — `94324c1 feat(auth): hoàn thiện refresh token và logout`
- FE-01 — `7cbbc45 feat(frontend): triển khai giao diện đăng nhập`
- FE-02 — `7aec955 feat(frontend): hoàn thiện phiên đăng nhập và đăng xuất`
- UI compatibility fix — `3effec4 fix(frontend): cập nhật Alert prop theo Ant Design 6`
- Integration — `test(auth): hoàn thiện kiểm thử luồng login logout`

## 10. Release readiness

**Ready for PR to `develop`.** The local branch is `feature/login-logout`; it has not been pushed and no PR has been opened.
