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
