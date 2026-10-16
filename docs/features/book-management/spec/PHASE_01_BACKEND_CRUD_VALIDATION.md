# PHASE 01 — Backend CRUD, Validation, Versioning

**Đầu vào:** MASTER_SPEC §§1–6, `Book.java`, `BookRepository.java`, migration 015, `loan_items`, Member CRUD/patterns và `GlobalExceptionHandler`. **Chỉ phase này**, không làm Search/CSV/FE.

## Mục tiêu
- Tạo Book API theo `GET detail`, `POST create`, `PUT update`, `DELETE delete`; DTO tách Entity, `ApiResponse`, 201/200/204; authority từng endpoint.
- Bổ sung `books.version` bằng **changeset mới** và `@Version` kiểm tra stale write. Không sửa 015 cũ.
- Sinh `book_code` server-side **tuần tự `B000001`, `B000002`, ... theo `books.id` AUTO_INCREMENT**, không để Admin nhập/sửa. Vì `book_code NOT NULL UNIQUE`, có thể dùng mã tạm nội bộ duy nhất khi insert, sau đó cập nhật mã chính thức dựa trên ID **trong cùng transaction**; rollback cả hai bước nếu lỗi, không lộ mã tạm. Không dùng `max(id)+1`/`count()+1` và không thêm bảng sequence nếu chưa được chấp thuận.
- ISBN-10/13: validate checksum, normalize ISBN-13, unique; null được; detect duplicate DB race; không dựa vào `exists` duy nhất.
- Create total>=0, available=total; update thay total theo invariant `oldTotal-oldAvailable`; `borrowFee/lateFeePerDay` bắt buộc, >=0, khớp DECIMAL(12,2).
- Update dùng PUT đủ field có `version`, optional field có thể null; update BookCode/id không hợp lệ. Với title+author trùng mà không ISBN: warning và xác nhận (không cản vĩnh viễn).
- Delete chỉ thành công khi không có `LoanItem`; FK bảo vệ khi race; lỗi business 409. Không cascade LoanItem.

## Đề xuất file/layer
`book/controller/BookController.java`, `book/dto/*.java`, `book/service/BookService.java`, `book/service/BookRules.java`, `book/repository/BookRepository.java`, `book/entity/Book.java`, `db/changelog/changes/<next>-add-books-version.yaml`, test ở `src/test/java/.../book/`.

## Acceptance criteria
1. Admin có `book:create` thêm được Book; `bookCode` tạo từ ID theo dạng `B000001` (>=6 chữ số), immutable, ISBN normalization đúng, available=total; mã nội bộ tạm không bao giờ xuất hiện trong response.
2. PUT stale version trả 409, không ghi đè; PUT xóa optional thành `null` được.
3. Update quantity: 10 total/6 available => update 8 total/4 available; update 3 => 422, dữ liệu không đổi.
4. Xóa Book không history => 204; Book có bất kỳ LoanItem history => 409.
5. 401 unauth, 403 thiếu permission/USER role mutation, 404 ID không tồn tại; lỗi không leak DB/stack trace.
6. 2 request create đồng thời phải sinh bookCode khác nhau; 2 request cùng ISBN không tạo trùng; rollback không để record hoặc bookCode tạm dở dang. Chấp nhận gap số sau rollback, không kỳ vọng code luôn liên tục.
7. Unit + integration test phản ánh dữ liệu sau rollback, không chỉ assert HTTP.

## Kiến thức/comment cần làm rõ
`@Entity`, `@Version`, `@Transactional`, optimistic lock, DB UNIQUE vs check exists, `BigDecimal`, service transaction, JavaDoc mục đích/cách hoạt động/lý do cho method nghiệp vụ. Không comment từng getter.

## Gate sang Phase 02
Build + tests phase 01 xanh với DB test riêng; review API contract, commit riêng; viết handoff (thay đổi, tests thực tế, lỗi chưa xử lý).
