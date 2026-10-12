# Superpowers skill preferences

Do not invoke `superpowers:brainstorming` or `superpowers:writing-plans` unless I explicitly ask for them.

## Permission Dependency Guidelines

- Đánh giá dependency theo nghiệp vụ cho mỗi permission mới; chỉ cập nhật registry tập trung sau khi quy tắc được chốt.
- Không mặc định mọi permission đều phụ thuộc `*:read`; không đổi permission contract nếu chưa được người dùng đồng ý.
- Backend phải enforce dependency; frontend chỉ hỗ trợ thao tác và preview, không thay thế validation phía server.
- Khi cấp quyền thao tác, tự thêm các dependency bắt buộc nếu actor được phép cấp; không vượt quá phạm vi quyền của actor.
- Khi gỡ quyền thao tác, giữ nguyên quyền cơ sở. Chỉ cho gỡ quyền cơ sở khi mọi quyền phụ thuộc liên quan cũng được gỡ hợp lệ trong cùng request.
- Bổ sung test cho cấp/gỡ quyền, dependency, authorization, rollback và dữ liệu Role–Permission hiện hữu.
- Tái sử dụng permission resolver, guard, Role Management và quy ước kiến trúc hiện có.
- Tuân thủ Git Flow, Liquibase, chính sách test/bảo vệ dữ liệu của project; không commit secrets.
- `AGENTS.md` là hướng dẫn phát triển, không thay thế validation thực tế trong code.

## Cô lập cơ sở dữ liệu cho test và worktree

- Dùng file `.env` ở thư mục gốc của worktree hiện tại làm nguồn cấu hình chuẩn cho tên database, user và cặp mật khẩu. Ứng dụng dùng `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`; integration test dùng `MYSQL_TEST_DATABASE`, `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD`. Spring đọc `.env`; Compose cũng dùng file này. Không lấy cấu hình từ worktree khác hoặc dựa vào database/user dùng chung.
- File `.env` của repo gốc có thể giữ database ứng dụng riêng của repo (hiện là `library_management`) và database test (`library_management_test`). Mỗi worktree tính năng phải tự đặt `MYSQL_DATABASE` và `MYSQL_TEST_DATABASE` trong `.env` của chính worktree đó trước khi chạy ứng dụng, Compose hoặc test. Nếu worktree chưa có `.env`, sao chép `.env.example` làm mẫu, sau đó đổi tên database mặc định của repo gốc và đặt user/cặp mật khẩu riêng cho worktree trước khi chạy. Dùng tên như `library_management_<worktree>` và `library_management_<worktree>_test`; thay dấu câu trong tên branch bằng dấu gạch dưới và giữ hậu tố `_test` cho database test.
- Mỗi integration test dùng `@SpringBootTest` phải khai báo `@ActiveProfiles("test")`. Cấu hình datasource của test chỉ được dùng `MYSQL_TEST_DATABASE`, `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD`; tuyệt đối không dùng database hoặc thông tin đăng nhập của ứng dụng. Guard trong test classpath từ chối database ngoài mẫu `library_management[_<worktree>]_test` và từ chối database test trùng `MYSQL_DATABASE` trước khi Liquibase chạy.
- Khai báo cả hai user và mật khẩu trong `.env` của từng worktree; dùng đúng `MYSQL_USER`/`MYSQL_PASSWORD` và `MYSQL_TEST_USER`/`MYSQL_TEST_PASSWORD` đã được cấp quyền cho các database tương ứng. User ứng dụng chỉ nên có quyền trên database ứng dụng của worktree đó; user test chỉ nên có quyền trên database test tương ứng. Không hard-code hoặc tự ý dùng user dự phòng. Không commit `.env` hoặc thông tin đăng nhập.
- Trước khi chạy `mvnw test`, khởi động database test tạm bằng `docker compose --profile test up -d --wait mysql-test`. Tên database và user lấy từ `.env` hiện tại; service yêu cầu các giá trị này, dùng `MYSQL_TEST_PORT` (mặc định `3308`) và lưu dữ liệu tạm trong `tmpfs`, không gắn volume của database ứng dụng.
- Khi chạy nhiều worktree cùng lúc, đặt `MYSQL_PORT`, `MYSQL_TEST_PORT` và `SERVER_PORT` khác nhau trong `.env` của từng worktree. Integration test phải dùng fixture riêng, không phụ thuộc dữ liệu trong database cá nhân hoặc database dùng chung.
