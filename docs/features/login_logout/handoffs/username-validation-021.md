# Handoff — Username Validation

## Thay đổi

- Giới hạn username từ 50 xuống 20 ký tự.
- Quy định username gồm 3–20 ký tự: a-z, A-Z, 0-9, _.
- Ngăn username có định dạng email và ký tự không hợp lệ.

## Database

- Liquibase migration: 021.
- accounts.username: VARCHAR(20).
- CHECK constraint: chk_accounts_username_format.
- Rollback khôi phục VARCHAR(50) và xóa CHECK constraint.

## Backend

- Account.java: cập nhật @Column(length = 20).
- Chưa triển khai Bean Validation tại Request DTO do chưa có API tạo/cập nhật tài khoản.

## Testing

- Kiểm tra migration và CHECK constraint.
- Kiểm tra username hợp lệ/không hợp lệ.
- Chạy Maven tests.
- Ghi kết quả thực tế tại đây.

## Ghi chú

- Không thay đổi logic đăng nhập bằng username/email.
- Áp dụng @Pattern khi triển khai API tạo/cập nhật tài khoản.
