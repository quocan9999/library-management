# PHASE 03 — Import CSV Partial

**Đầu vào:** Master Spec §§3.3, 4, 6, 9 và Phase 02 handoff. Câu 22B/23B/24A đã được chốt trong Master Spec §9; không tự đổi những quy tắc này.

## Mục tiêu
- `POST /api/v1/books/import` multipart `file`, `book:import` + Admin guard; Apache Commons CSV phiên bản tương thích Maven/Spring Boot hiện hữu.
- Validate `.csv`, file **nhỏ hơn** `5*1024*1024` bytes, header bắt buộc, UTF-8(+BOM), dữ liệu multiline CSV, empty-file, parse/number/date invalid.
- Required columns: `title,author,total_quantity,borrow_fee,late_fee_per_day`; optional header `isbn,publisher,published_date`; không có `book_code`.
- Mỗi dòng áp dụng rules Create về dữ liệu, ISBN-10 canonical13/unique, `bookCode` tuần tự theo ID và `available=total`. **Ngoại lệ cho confirm:** nếu dòng CSV **không ISBN** trùng title+author (đã chuẩn hóa) với sách không ISBN trong DB/đã import trước đó, **skip đúng dòng đó**, ghi lỗi `SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION`; không tự xác nhận hay mở pop-up trong batch. Form Create vẫn cho Admin xác nhận cảnh báo theo câu 19A.
- Partial: duyệt tuần tự, mỗi row valid commit riêng; invalid row rollback riêng và ghi lý do; các row sau tiếp tục. Không dùng `@Transactional(REQUIRES_NEW)` qua self-invocation; tách row persistence qua bean/proxy thật. Phát hiện sách tương tự không ISBN phải xét cả concurrency: chỉ gọi `exists()` trước `save()` chưa bảo đảm an toàn nếu hai import đồng thời.
- Bắt exception DB integrity và nhận diện đúng ISBN/bookCode conflict, không biến mọi lỗi DB thành duplicate. Lỗi infrastructure nghiêm trọng phải dừng an toàn hoặc fail request, không “báo thành công” giả.

## API/report (đề xuất)
`{ totalRows, importedRows, failedRows, errors: [{rowNumber, field?, code, message}] }` nằm trong `ApiResponse.data`. **HTTP 200 khi file hợp lệ đã xử lý xong, bất kể 1, một phần hay 0 dòng được nhập** (câu 24A); code/message phải thể hiện chính xác số sách được thêm, không nói "import thành công" khi `importedRows=0`. Lỗi định dạng toàn file/header, quá 5 MiB, file rỗng/không có data và lỗi hệ thống phải trả status lỗi tương ứng. FE chỉ hiển thị report trong Modal, không có download.

## Acceptance criteria
1. CSV 3 dòng: valid ISBN-10, duplicate ISBN, valid no-ISBN => 2 success /1 failed, DB đúng 2 bản ghi.
2. CSV có ISBN duplicate DB; dòng ISBN hợp lệ đầu tiên thành công và dòng tiếp theo trùng ISBN bị từ chối trong cùng file. CSV không ISBN trùng title+author với bản ghi không ISBN đã có thì dòng đó thất bại với lý do phải thêm thủ công; vẫn import các dòng còn lại. Không update existing Book.
3. Exactly 5 MiB => reject; file >5 MiB reject; non-.csv, empty, no header, malformed quotes, dữ liệu âm/fee lớn/date sai => kiểm tra và thông báo phù hợp.
4. Dòng thất bại không để lại Book/counter bẩn; transaction độc lập thật được integration test xác nhận.
5. File CSV hợp lệ có **tất cả dòng dữ liệu lỗi** trả 200 và report `importedRows=0`, `failedRows=totalRows`, không ghi thêm Book; UI hiển thị lỗi trong Modal.
6. `401/403` và lỗi upload, charset, lỗi infrastructure không để lộ stack/SQL; invalid file/header không được báo 200.

## Kiến thức/comment
`MultipartFile`, stream parse, Commons CSV, Spring transaction propagation/proxy, per-row rollback, mapping error và row index; JavaDoc đủ WHAT/HOW/WHY.

## Gate
Tests + commit + handoff, report shape cố định để Phase 04 dùng.
