# Handoff — Fix JWT Filter Registration

## 1. Thông tin

- **Project:** Library Management System

- **Feature:** Login / Refresh / Logout

- **Branch sửa lỗi:** `fix/jwt-filter-registration`

- **Branch đích:** `feature/login-logout`

- **Phạm vi:** Spring Security — JWT Authentication Filter

## 2. Nguyên nhân

`JwtAuthenticationFilter` được khai báo là Spring Bean thông qua `@Bean` trong `SecurityConfig.java`, đồng thời được thêm vào Spring Security Filter Chain bằng `addFilterBefore()`.

Spring Boot có thể tự động đăng ký các Filter Bean vào Servlet Filter Chain, dẫn đến nguy cơ JWT Filter được đăng ký ở cả Servlet Filter Chain và Spring Security Filter Chain.

## 3. Giải pháp

Bổ sung `FilterRegistrationBean<JwtAuthenticationFilter>` trong `SecurityConfig.java`:

```
@Beanpublic FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(        JwtAuthenticationFilter jwtAuthenticationFilter) {    FilterRegistrationBean<JwtAuthenticationFilter> registration =            new FilterRegistrationBean<>(jwtAuthenticationFilter);    registration.setEnabled(false);    return registration;}
```

- Giữ `JwtAuthenticationFilter` dưới dạng Spring Bean để sử dụng Dependency Injection.

- Sử dụng `setEnabled(false)` để vô hiệu hóa việc tự động đăng ký JWT Filter tại Servlet container.

- Giữ nguyên `addFilterBefore()` để JWT Filter chỉ được đăng ký thông qua Spring Security Filter Chain.

- Không thay đổi business logic xác thực JWT, refresh token hoặc logout.

## 4. File thay đổi

| File                                                                                                       | Nội dung                                  |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `src/main/java/sparkminds/librarymanagement/config/SecurityConfig.java`                                    | Bổ sung cấu hình `FilterRegistrationBean` |
| `src/test/java/sparkminds/librarymanagement/regression/security/JwtFilterRegistrationRegressionTests.java` | Bổ sung 2 regression tests                |

## 5. Kiểm thử

Chạy riêng regression test:

```
.\mvnw.cmd -Dtest=JwtFilterRegistrationRegressionTests test
```

**Kết quả: PASS**

```
Tests run: 2, Failures: 0, Errors: 0BUILD SUCCESS
```

Các trường hợp đã kiểm thử:

1. `jwtFilterShouldNotBeAutoRegistered`: xác nhận `FilterRegistrationBean` bị vô hiệu hóa và tham chiếu đúng JWT Filter Bean.

2. `jwtFilterShouldBeRegisteredOnceInSecurityChain`: xác nhận JWT Filter Bean xuất hiện đúng một lần trong Spring Security Filter Chain.

Hai bài test xác nhận cấu hình đăng ký Filter; chưa đo trực tiếp số lần thực thi trên HTTP request thực tế.

**Toàn bộ backend tests:** Chưa ghi nhận kết quả chạy lại sau thay đổi.

## 6. Trạng thái bàn giao

- Bổ sung cấu hình ngăn JWT Filter tự động đăng ký tại Servlet container.

- Giữ JWT Filter trong Spring Security Filter Chain.

- Bổ sung và chạy thành công 2 regression tests.

- Chạy lại toàn bộ backend tests.

- Commit và merge thay đổi về `feature/login-logout`.

## 7. Ghi chú

- Không thay đổi API contract.

- Không thay đổi database schema hoặc Liquibase migrations.

- Không thay đổi JWT claims hoặc token lifecycle.

- Sau khi merge, cần chạy lại toàn bộ backend tests để xác nhận không có regression ở các chức năng khác.
