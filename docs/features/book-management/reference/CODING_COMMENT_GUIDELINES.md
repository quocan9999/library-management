# Quy chuẩn comment code cho Agent

Áp dụng cho **Library Management System** (Java 17, Spring Boot, React + TypeScript) và có thể tái sử dụng cho các feature/Agent khác.

## Mục tiêu

> **Bổ sung riêng cho feature Book Management (theo yêu cầu học Fresher Java):**
> JavaDoc ở **method nghiệp vụ quan trọng** cần mở đầu bằng mô tả **hàm dùng để làm gì, được gọi trong tình huống nào**, sau đó tóm tắt **các bước xử lý chính (HOW)**, giải thích **vì sao/những ràng buộc nghiệp vụ (WHY)** và nêu đầu vào/đầu ra/exception khi hữu ích.
> Điều này **không** có nghĩa phải comment từng dòng hoặc getter/setter; câu "ưu tiên WHY thay vì WHAT" bên dưới áp dụng chủ yếu cho **inline comment** ở thao tác đã tự hiển nhiên.

Code phải **dễ đọc, dễ hiểu và dễ bảo trì**, kể cả khi không có comment. Comment chỉ bổ sung những thông tin khó nhận ra từ code: **vì sao** chọn cách xử lý, **quy tắc nghiệp vụ** và **những ràng buộc/trường hợp đặc biệt**.

## 10 quy tắc comment

| # | Quy tắc | Cách thực hiện |
|---|---|---|
| 1 | **Comment bằng tiếng Việt** | Viết rõ ràng, dễ hiểu; giữ nguyên thuật ngữ kỹ thuật như Java, Spring, JPA, JWT, Transaction, Optimistic Locking. |
| 2 | **Ưu tiên WHY thay vì WHAT** | Giải thích lý do và mục đích của xử lý; không diễn đạt lại từng dòng code đã hiển nhiên. |
| 3 | **JavaDoc cho method nghiệp vụ quan trọng** | Nêu chức năng, quy tắc nghiệp vụ, điều kiện đặc biệt và lỗi quan trọng khi có giá trị giúp người đọc. |
| 4 | **Comment Repository query phức tạp** | Giải thích `JOIN`, `EXISTS`, subquery, aggregate, điều kiện lọc và lý do chọn chiến lược truy vấn. |
| 5 | **Comment Security và Transaction** | Giải thích những điểm không hiển nhiên về phân quyền, thu hồi JWT, chống race condition, rollback và ranh giới transaction. |
| 6 | **Comment validation đặc biệt** | Làm rõ quy tắc như tuổi tối thiểu 16, số điện thoại Việt Nam, PATCH giữ nguyên trường rỗng/không gửi. |
| 7 | **Comment logic Frontend phức tạp** | Giải thích debounce, bỏ qua response cũ, duy trì bộ lọc trong `sessionStorage`, xử lý `409 Conflict`, state transition. |
| 8 | **Đặt comment gần code liên quan** | Comment phải nằm ở nơi người đọc dễ liên hệ với logic được giải thích. |
| 9 | **Không comment code hiển nhiên** | Không bắt buộc comment getter/setter, constructor đơn giản, import, từng dòng JSX hoặc những câu lệnh có tên rõ nghĩa. |
| 10 | **Giữ comment đúng với code hiện tại** | Khi sửa logic phải sửa/xóa comment tương ứng; không để comment lỗi thời, TODO mơ hồ hay mô tả chức năng chưa triển khai. |

## Cách sử dụng từng kiểu comment

### 1. JavaDoc cho method nghiệp vụ (Java)

```java
/**
 * Cập nhật thông tin hồ sơ Member.
 *
 * <p>Chỉ cập nhật các trường được cung cấp và có giá trị.
 * Kiểm tra version để tránh ghi đè dữ liệu khi nhiều
 * Admin cùng chỉnh sửa một Member.
 */
@Transactional
public MemberResponse updateProfile(...) {
    // ...
}
```

**Lưu ý:** Đây là ví dụ minh họa cách viết comment, không phải chữ ký method hoàn chỉnh. Chỉ dùng các `@param`, `@return`, `@throws` trong JavaDoc khi chúng bổ sung thông tin hữu ích và khớp code thực tế. Không tạo exception mới chỉ để khớp comment.

### 2. Inline comment cho quyết định kỹ thuật (Java)

```java
// Dùng EXISTS thay vì JOIN để tránh mỗi Member xuất hiện
// nhiều lần khi có nhiều LoanItem khớp điều kiện tìm kiếm.
```

Comment này giải thích **vì sao** chọn `EXISTS`, thay vì chỉ mô tả rằng code đang truy vấn dữ liệu.

### 3. JSDoc cho helper/hook phức tạp (TypeScript)

```ts
/**
 * Debounce tìm kiếm trong 450ms để hạn chế request.
 * Bỏ qua response cũ để không hiển thị kết quả
 * không còn khớp với bộ lọc hiện tại.
 */
```

Chỉ dùng khi helper/hook thực sự có logic tương ứng; comment không được thay thế việc xử lý hủy request hoặc kiểm tra response cũ trong code.

## Những điều không nên làm

**Không comment lại một thao tác hiển nhiên:**

```java
// Lấy Member theo ID
Member member = memberRepository.findById(id).orElseThrow(...);
```

**Không dùng comment để che giấu code khó đọc:** Nếu một method quá dài (ví dụ 200 dòng) hoặc ôm nhiều trách nhiệm, ưu tiên tách thành các method nhỏ, đặt tên có ý nghĩa rồi mới bổ sung comment ở những phần thật sự cần thiết.

**Không đưa dữ liệu nhạy cảm vào comment:** Không ghi password, JWT, secrets, thông tin cá nhân thực hoặc dữ liệu nội bộ không cần thiết.

**Không comment khẳng định sai:** Không viết “đã xử lý rollback”, “đã tránh N+1” hoặc “đã bảo đảm thread-safe” nếu implementation/test không chứng minh được.

## Checklist tự review dành cho Agent

- [ ] Code và tên method/class đã đủ rõ nghĩa trước khi thêm comment.
- [ ] JavaDoc được dùng ở method nghiệp vụ quan trọng khi thực sự cần.
- [ ] Repository query, Security, Transaction, concurrency và validation khó có giải thích lý do thiết kế.
- [ ] Frontend logic phức tạp được chú thích đúng cách.
- [ ] Không có comment hiển nhiên hoặc trùng lặp.
- [ ] Comment nằm gần code và nhất quán với hành vi thực tế.
- [ ] Không có dữ liệu nhạy cảm hay lời hứa về chức năng chưa được thực hiện.

## Nguyên tắc kết luận

> **Code phải tự giải thích được phần lớn hành vi. Comment giải thích nghiệp vụ và lý do thiết kế mà code chưa thể hiện rõ — không biến comment thành bản dịch từng dòng code.**
