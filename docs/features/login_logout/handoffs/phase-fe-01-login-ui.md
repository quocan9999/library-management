# Handoff — Phase FE-01: Login UI

## 1. Goal

Create the React login experience against the real authentication API, keep the access token in memory, and protect the greeting-only home route.

## 2. Delivered

- Added the React, TypeScript, Vite, React Router, Axios, Ant Design, React Hook Form, and Zod frontend under `frontend/`.
- Built `/login` to match the Athenaeum Minimal direction in `DESIGN.md`, including a responsive archival split layout, Inter typography, navy and amber accents, accessible field labels, linked inline validation, loading state, and server error copy.
- Connected `POST /api/v1/auth/login` with `withCredentials: true`. The returned access token lives only in React memory; the refresh token remains in the backend-set HttpOnly cookie.
- Added a protected `/` route whose only content is `Hello Library Management`.
- Added clear user-facing messages for invalid credentials, disabled accounts, network failures, and unexpected server errors without showing backend exception text.

## 3. Main files

- `frontend/package.json` and `frontend/package-lock.json`
- `frontend/src/main.tsx`
- `frontend/src/auth/api.ts`
- `frontend/src/auth/types.ts`
- `frontend/src/auth/AuthContext.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/styles.css`

## 4. Implemented flow

1. An unauthenticated visit to `/` redirects to `/login`.
2. The form validates the identifier and password with React Hook Form and Zod.
3. The API client posts credentials with cookie support enabled.
4. A successful response stores only the access token in in-memory auth state and navigates to `/`.
5. The refresh cookie is not read by JavaScript. Authentication errors are mapped to user-facing copy; field validation errors remain associated with their inputs.

## 5. Technical decisions

- Kept the frontend in this repository because there is no separate frontend repository in the available workspace.
- Used the current compatible package versions and committed the npm lockfile for repeatable installs.
- Did not add a frontend test framework because the plan calls for browser checks and says not to introduce one solely for this feature.
- Kept the root route intentionally free of dashboards and role-specific content.

## 6. Automated verification

- `npm run lint` — passed.
- `npm run build` — passed with TypeScript 6.0.3 and Vite 8.3.3.
- The production build reports one 681.67 kB minified JavaScript chunk (222.45 kB gzip), above Vite's 500 kB advisory threshold. It is a warning; the build succeeds.

## 7. Browser verification

- Chrome DevTools: login rendered at desktop size and at a 390 × 844 mobile viewport; the mobile document width matched the viewport and the form remained usable.
- Empty submission showed both required field errors and focused the first invalid field.
- Unknown credentials returned HTTP 401 and showed the generic credential message.
- `admin/admin`, `user/user`, and `user@gmail.com/user` each returned HTTP 200 and reached `/` with `Hello Library Management`.
- Browser storage key lists were empty after successful login. No refresh token or access token value was inspected or exposed; the refresh cookie was not visible to JavaScript.
- Cookie-based logout calls returned HTTP 200 after the manual successful logins, clearing the test sessions.
- Chrome reported no console warnings or errors on the successful demo-user run.

## 8. Known limitations

- FE-02 still needs to add session restoration, Axios refresh/retry, and a logout action in the app shell.
- The disabled-account message is mapped from `AUTH_ACCOUNT_DISABLED`; backend Phase 6 integration tests cover that response. A disabled account was not toggled in the live browser.
- Chrome's Offline emulation navigated the page to its own network error before the form could submit, so the frontend network-error message was not manually exercised in this browser session.
- No automated frontend test runner was introduced for FE-01.

## 9. Next phase

Implement FE-02 session restoration, access-token refresh and retry, and the minimal logout control. Then verify refresh-on-reload, expired-access retry, and logout against the running backend.

## 10. Commit

`feat(frontend): triển khai giao diện đăng nhập`
