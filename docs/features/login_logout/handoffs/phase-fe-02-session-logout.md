# Handoff — Phase FE-02: Session restore and logout

## 1. Goal

Complete the frontend session lifecycle with refresh-cookie restoration, one-time refresh and retry for expired access tokens, and local sign-out.

## 2. Delivered

- Added an in-memory access-token store and connected it to React with `useSyncExternalStore`, so the Axios client and rendered auth state stay synchronized.
- Added startup session restoration through `POST /api/v1/auth/refresh`, guarded by a bootstrap state so protected and public routes do not flash before the cookie check finishes.
- Deduplicated startup refresh while React Strict Mode repeats effects in development.
- Added a Bearer request interceptor and a response interceptor that refreshes only `401 AUTH_TOKEN_EXPIRED`, shares one refresh across concurrent requests, retries each request once, and clears the in-memory token when refresh fails.
- Added the minimal “Sign out” header action. It sends the optional Bearer token and cookie, then clears local auth state even if the API call fails.
- Kept `/` focused on `Hello Library Management`; no dashboard or role-specific content was added.
- Added Vitest and seven deterministic tests for interceptor and auth request behavior.

## 3. Main files

- `frontend/src/auth/api.ts`
- `frontend/src/auth/api.test.ts`
- `frontend/src/auth/tokenStore.ts`
- `frontend/src/auth/AuthContext.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/styles.css`
- `frontend/package.json` and `frontend/package-lock.json`

## 4. Implemented flow

1. On page load, the provider calls the refresh endpoint with cookies enabled and shows a small bootstrap status until it resolves.
2. Success puts the new access token into memory; a missing, expired, or revoked refresh cookie leaves the provider unauthenticated and the route redirects to `/login`.
3. Protected API requests receive the current Bearer token. Only the backend’s `AUTH_TOKEN_EXPIRED` code can trigger refresh.
4. Concurrent expired requests share one refresh call. Each original request retries once with the new token; a repeated expiry or refresh failure clears auth state.
5. Sign-out posts both available credentials. The UI always clears the local token and returns to login; repeated logout remains safe under the backend’s idempotent contract.

## 5. Technical decisions

- Kept auth endpoints on the same Axios instance but marked them to skip access-token injection and refresh handling. They still send credentials; logout can supply its explicit Bearer header.
- Used one module-level restore promise to collapse React Strict Mode’s repeated bootstrap effect into one single-use refresh rotation.
- Used Vitest 5.0.3, compatible with the existing Vite 8 setup and Node 24 environment. The tests use Axios adapters instead of adding an HTTP mocking dependency.
- No protected business endpoint exists in the current backend, so the expired-token interceptor behavior is exercised with a deterministic Axios adapter; refresh and logout lifecycle are also verified against the live backend.

## 6. Automated verification

- `npm test` — 7 passed, 0 failed.
- `npm run lint` — passed.
- `npm run build` — passed with TypeScript 6.0.3 and Vite 8.3.3.
- The build retains the existing advisory for a 683.62 kB minified JavaScript chunk (223.24 kB gzip); the build succeeds.

## 7. Browser verification

- Chrome DevTools: admin login, then page reload with a valid refresh cookie issued one `POST /api/v1/auth/refresh` (HTTP 200) and restored the protected greeting without returning to login.
- A clean isolated browser context with no refresh cookie issued one refresh request (HTTP 401) and remained at `/login`.
- `user/user` reached the same greeting, and the “Sign out” action was present after login.
- Clicking “Sign out” called logout successfully (HTTP 200), cleared local auth state, and returned to `/login`. A repeated logout with no cookie or Bearer token also returned HTTP 200.
- Browser checks at 375 × 812 and 844 × 390 landscape had no horizontal overflow. Storage key lists remained empty and the HttpOnly refresh cookie was not visible through `document.cookie`.
- Chrome reported no console warnings or errors on the successful restored-session run.

## 8. Known limitations

- There is no protected business API in the current backend to drive a real HTTP expired-access retry; deterministic tests cover the interceptor’s exact code matching, single retry, concurrent single-flight refresh, and refresh failure cleanup.
- The refresh-cookie failure response is tested in the browser with a missing cookie; revoked/expired refresh behavior is covered by backend Phase 14 tests and the same frontend failure path.
- The Vite bundle-size advisory remains; no code-splitting change was made in this phase.

## 9. Next phase

Run the final backend/frontend integration checklist: backend full test suite, frontend test/lint/build, and browser checks for login, reload restore, refresh retry tests, logout, storage boundaries, and cookie handling. Then write the integration handoff.

## 10. Commit

`feat(frontend): hoàn thiện phiên đăng nhập và đăng xuất`
