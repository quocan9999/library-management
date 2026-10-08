# Handoff — credentials Axios và mã lỗi nội bộ

## Hai vấn đề đã xử lý

1. Axios client mặc định đặt `withCredentials: false` cho request thông thường. Cấu hình này tắt việc chủ động gửi credentials cho request cross-origin, không cấm cookie same-origin. `authRequestConfig` của login, refresh và logout vẫn đặt `withCredentials: true`; request thông thường tiếp tục nhận Bearer header qua interceptor.
2. `GlobalExceptionHandler.handleUnexpected` vẫn trả HTTP 500 qua `HttpStatus.INTERNAL_SERVER_ERROR`, nhưng JSON `code` đổi thành `INTERNAL_ERROR`. Message vẫn là `Đã xảy ra lỗi hệ thống`; exception message và stack trace không được đưa vào response.

Contract và ví dụ API hiện có đã dùng `INTERNAL_ERROR`, nên không cần sửa. Không sửa backend ngoài handler và regression test; không sửa JWT, cookie, CORS, migration, UI hoặc `withCredentials` override của auth endpoints.

## Thay đổi

- `frontend/src/auth/api.ts`
- `frontend/src/tests/auth/api.test.ts`
- `src/main/java/sparkminds/librarymanagement/common/api/GlobalExceptionHandler.java`
- `src/test/java/sparkminds/librarymanagement/regression/api/GlobalExceptionHandlerRegressionTests.java`
- `docs/features/login_logout/handoffs/fix-credentials-and-internal-error.md`

Frontend tests xác nhận request protected dùng `withCredentials: false` nhưng vẫn có Bearer header; login/refresh/logout đều dùng credentials. Test backend dùng `MockMvcBuilders.standaloneSetup` và `GlobalExceptionHandler` thật để xác nhận HTTP 500, JSON `INTERNAL_ERROR`, message chung, timestamp và không lộ exception detail.

## Context7 đã tra cứu

Context7 trả tài liệu Axios 1.x ở phiên bản được index `v1.7.9`, Spring Framework `v7.0.5`, và Spring Boot `v4.1.0`. Repository khai báo Axios `^1.20.0` và Spring Boot `4.1.1`; truy vấn Framework/Boot dùng major versions theo yêu cầu và phiên bản tài liệu gần nhất mà Context7 cung cấp.

- Axios 1.x — adapter nhận config đã merge với defaults sau request interceptors; response interceptors chạy sau khi adapter settle: [Axios adapter docs](https://github.com/axios/axios/blob/v1.7.9/lib/adapters/README.md), [Axios dispatch request source](https://github.com/axios/axios/blob/v1.x/lib/core/dispatchRequest.js).
- Spring Framework 7 — semantics của `@ControllerAdvice`/`@RestControllerAdvice`/`@ExceptionHandler` và cấu hình standalone MockMvc: [Controller advice](https://github.com/spring-projects/spring-framework/blob/v7.0.5/framework-docs/modules/ROOT/pages/web/webmvc/mvc-controller/ann-advice.adoc), [MockMvc standalone setup](https://github.com/spring-projects/spring-framework/blob/v7.0.5/framework-docs/modules/ROOT/pages/testing/mockmvc/hamcrest/setup.adoc).
- Spring Boot 4 — tài liệu kiểm thử web/MVC dùng MockMvc: [Testing Spring Boot applications](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/spring-boot-applications.adoc).

## Kết quả kiểm thử thực tế

| Lệnh | Kết quả |
| --- | --- |
| `npm run test` | PASS — 2 files, 13 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS — Vite có cảnh báo chunk lớn hơn 500 kB; cảnh báo đã tồn tại trước thay đổi và không được chỉnh trong issue này |
| `.\mvnw.cmd -Dtest=GlobalExceptionHandlerRegressionTests test` | PASS — 1 test, 0 failures/errors/skips |
| `.\mvnw.cmd clean test` | PASS — 28 tests, 0 failures/errors/skips |

### Browser verification — Chrome DevTools MCP

Đăng nhập bằng tài khoản demo qua frontend local và backend mới trên cổng 8082. Các quan sát chỉ ghi URL path, `withCredentials`, việc có Authorization header, HTTP status và JSON code; không ghi giá trị token/cookie.

- Login: `POST /api/v1/auth/login` — `withCredentials=true`, HTTP 200, `AUTH_LOGIN_SUCCESS`.
- Reload khi còn session: `POST /api/v1/auth/refresh` — `withCredentials=true`, HTTP 200, `AUTH_TOKEN_REFRESHED`.
- Logout: `POST /api/v1/auth/logout` — `withCredentials=true`, Authorization header có mặt, HTTP 200, `AUTH_LOGOUT_SUCCESS`; frontend về `/login`.
- Reload sau logout: refresh nhận HTTP 401, `AUTH_REFRESH_TOKEN_MISSING`; frontend vẫn ở `/login`, không khôi phục session.
- Test browser protected API: không có màn hình nào trong flow login gọi `/api/v1/books`; cấu hình mặc định `false` cùng Bearer header được kiểm tra bằng regression test Vitest.

Cổng 8081 đã có một process Java `LibraryManagementApplication` chạy từ trước. Không dừng process đó; browser check dùng tạm `SERVER_PORT=8082` và `VITE_API_BASE_URL=http://localhost:8082` qua environment của tiến trình, không sửa file cấu hình repository. Hai tiến trình frontend/backend do test khởi chạy đã được dừng sau khi kiểm tra.

## Giới hạn còn lại

- `docs/login_flow_code_walkthrough.md` còn ghi nhận sự khác nhau cũ giữa `INTERNAL_SERVER_ERROR` và `INTERNAL_ERROR`. API contract và ví dụ API đã đúng; walkthrough này không thuộc phạm vi cập nhật tài liệu cho phép trong plan nên được giữ nguyên, nhưng đoạn ghi nhận đó không còn phản ánh source hiện tại.
- Build tiếp tục có cảnh báo bundle Vite lớn hơn 500 kB; tối ưu bundle nằm ngoài phạm vi.
