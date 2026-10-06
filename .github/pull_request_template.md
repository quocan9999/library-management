## 📌 Mô tả

Mô tả ngắn gọn những thay đổi trong Pull Request này.

Ví dụ:

- Thêm API đăng nhập bằng username/email và password.
- Thêm Liquibase changeset tạo bảng `roles`.
- Fix lỗi validate dữ liệu khi tạo/cập nhật Book.

---

## 🔗 Related Issue / Task

Closes #

<!--
Ví dụ:
Closes #12
Fixes #15

Nếu không có Issue thì ghi:
N/A
-->

---

## 🏷️ Loại thay đổi

- [ ] ✨ Feature
- [ ] 🐛 Bug Fix
- [ ] 🔥 Hotfix
- [ ] ♻️ Refactor
- [ ] 🎨 UI/UX
- [ ] 🗄️ Database / Migration
- [ ] 📝 Documentation
- [ ] 🔧 Configuration / Chore
- [ ] 🧪 Test

---

## 🛠️ Những thay đổi chính

<!-- Liệt kê các thay đổi quan trọng -->

- 
- 
- 

---

## 🧾 Các commit trong PR

<!-- Liệt kê các commit theo thứ tự từ cũ đến mới; cập nhật mục này khi push thêm commit. Lưu các các hash phải là hyperlink có thể click được -->

- `hash` Mô tả commit

---

## 🧪 Cách kiểm tra

<!--
Ghi các lệnh có thể sao chép và chạy từ root repo.
Giữ lại những lệnh áp dụng cho PR hiện tại và xóa các lệnh không cần thiết.
-->

### Backend

Windows:

```powershell
.\mvnw.cmd clean test
.\mvnw.cmd clean verify
```

macOS / Linux:

```bash
./mvnw clean test
./mvnw clean verify
```

### Database / Liquibase

Nếu PR có thay đổi database, migration hoặc datasource:

```powershell
docker compose up -d
.\mvnw.cmd spring-boot:run
```

Kiểm tra:

- Spring Boot kết nối MySQL thành công.
- Liquibase chạy changeset thành công.
- Không có lỗi migration khi restart application.
- `DATABASECHANGELOG` ghi nhận changeset mới.
- Schema sau migration đúng với thiết kế.

### Kiểm tra API thủ công

Có thể dùng Postman, Swagger UI hoặc browser tùy endpoint.

Ví dụ:

1. Khởi động MySQL bằng Docker.
2. Chạy Spring Boot application.
3. Gọi endpoint liên quan.
4. Kiểm tra HTTP status, response body và dữ liệu trong MySQL.

### Kết quả mong đợi

- 

---

## 📸 Screenshots / Video

<!--
Nếu có thay đổi giao diện thì thêm ảnh/video tại đây.
Backend-only PR có thể ghi N/A.
-->

N/A

---

## ⚠️ Ảnh hưởng / Lưu ý

<!--
Ví dụ:
- Có thay đổi database schema (mô tả rõ).
- Có Liquibase changeset mới.
- Cần chạy migration khi application khởi động.
- Có biến môi trường mới trong `.env.example`.
- Có thay đổi API contract.
- Có breaking change.
-->

N/A

---

## ✅ Checklist

- [ ] Code đã chạy và hoạt động đúng ở local.
- [ ] Đã tự review code trước khi tạo PR.
- [ ] Build/Test liên quan đã chạy thành công.
- [ ] Không còn code debug, `System.out.println` hoặc log tạm không cần thiết.
- [ ] Không commit thông tin nhạy cảm (`.env`, password, secret, API key...).
- [ ] Nếu thêm biến môi trường mới, đã cập nhật `.env.example`.
- [ ] Nếu thay đổi database schema, đã tạo Liquibase changeset tương ứng.
- [ ] Không sửa/xóa changeset Liquibase đã được áp dụng ở môi trường dùng chung.
- [ ] Project vẫn giữ `spring.jpa.hibernate.ddl-auto=none`.
- [ ] Đã xử lý các trường hợp lỗi liên quan.
- [ ] Đã kiểm tra không làm hỏng chức năng hiện tại.
- [ ] Đã cập nhật documentation nếu cần.
- [ ] Branch đã được cập nhật với branch đích mới nhất.

---

## 👀 Ghi chú cho Reviewer

<!--
Những phần muốn reviewer chú ý đặc biệt.

Ví dụ:
- Review giúp transaction boundary của borrow/return flow.
- Review giúp permission mapping cho endpoint mới.
- Review giúp Liquibase constraint/index vừa thêm.
-->

N/A
