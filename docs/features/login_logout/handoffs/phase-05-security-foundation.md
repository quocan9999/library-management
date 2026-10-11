# Handoff — Phase 5: Spring Security Foundation

## 1. Mục tiêu phase

Hoàn thiện Spring Security stateless, kết nối account trong database với Authentication/Authorization, xác minh mật khẩu bằng BCrypt và seed account demo USER qua Liquibase.

## 2. Những gì đã hoàn thành

- Thêm `SecurityFilterChain` stateless; tắt CSRF, form login và HTTP Basic.
- Cấu hình CORS local cho `http://localhost:5173`, credentials, methods và headers theo tài liệu.
- Thêm `CustomUserPrincipal` và `CustomUserDetailsService`, tìm account theo username hoặc email.
- Nạp `Account → Role → Permission` bằng entity graph trong transaction read-only; permission code trở thành `GrantedAuthority`.
- Cấu hình BCrypt và `AuthenticationManager` với `DaoAuthenticationProvider`.
- Thêm changeset Liquibase idempotent cho `user / user@gmail.com`, hash BCrypt, `ROLE_USER`, enabled và email_verified.
- Giữ nguyên seed admin hiện tại.

## 3. File chính đã thêm/sửa

- `src/main/java/sparkminds/librarymanagement/config/SecurityConfig.java`
- `src/main/java/sparkminds/librarymanagement/auth/security/CustomUserPrincipal.java`
- `src/main/java/sparkminds/librarymanagement/auth/security/CustomUserDetailsService.java`
- `src/main/java/sparkminds/librarymanagement/auth/repository/AccountRepository.java`
- `src/main/resources/db/changelog/changes/020-seed-demo-user.yaml`
- `src/main/resources/db/changelog/db.changelog-master.yaml`
- `.env.example`
- `src/test/java/sparkminds/librarymanagement/auth/security/SecurityFoundationIntegrationTests.java`

## 4. Luồng xử lý đã triển khai

Spring Security gửi identifier vào `CustomUserDetailsService`; repository lấy Account cùng Role và Permission; principal giữ account id, password hash, trạng thái enabled và permission authorities. `DaoAuthenticationProvider` xác minh mật khẩu bằng BCrypt. Request auth được cho qua security chain để các phase sau triển khai endpoint; request khác yêu cầu authentication.

## 5. Quyết định kỹ thuật quan trọng

- Permission code là authority (`book:read`, `borrow:create`); role code không được dùng thay permission.
- Entity graph nạp quan hệ trước khi principal được tạo, tránh trả authority dựa trên lazy relation chưa tải.
- Seed USER dùng `INSERT … SELECT … WHERE NOT EXISTS`; không lưu mật khẩu thô và không sửa account có cùng username/email.
- CORS chỉ cho origin đã chốt; không dùng wildcard.

## 6. Test đã chạy + kết quả

- `.\mvnw.cmd -Dtest=SecurityFoundationIntegrationTests test` — 6 tests passed.
- `.\mvnw.cmd test` — 7 tests passed, 0 failures, 0 errors.
- Liquibase applied changeset 020 once; the subsequent full test run confirmed all 20 changesets were already applied.

## 7. Manual/Postman test

Chưa chạy Postman. Phase này chưa có business auth endpoint; CORS preflight và account/security behavior được kiểm tra bằng MockMvc trên MySQL local.

## 8. Known limitations / việc chưa làm

Login endpoint, JWT issuance/filter, normalized 401/403 handlers, refresh rotation and logout remain for their planned phases. No frontend has been added yet.

## 9. Việc phase tiếp theo cần tiếp tục

Phase 6: implement `POST /api/v1/auth/login`, HS256 access/refresh JWT, refresh metadata persistence, cookie policy and contract validation/error responses.

## 10. Commit message của phase

```text
feat(security): hoàn thiện nền tảng Spring Security

- Cấu hình SecurityFilterChain, CORS, CSRF và stateless session
- Tích hợp Account, Role và Permission với Spring Security
- Bổ sung BCrypt và tài khoản demo user/user bằng Liquibase
- Bổ sung kiểm thử cho security foundation
- Thêm handoff Phase 5
```
