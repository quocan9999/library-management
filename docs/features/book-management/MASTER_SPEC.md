# MASTER SPEC — Admin Book Management

- **Dự án:** Library Management System — Bài tập 1 (Fresher Java)
- **Phạm vi:** Phase 09, màn hình quản lý sách ADMIN + Backend API hỗ trợ
- **Trạng thái:** SPEC/DRAFT, chưa triển khai/kiểm thử/commit
- **Nguồn so sánh:** `origin/develop` tại `e30c32d6daab700ee840874c2f0fe0824670b3f1` (kiểm tra 2026-10-16)
- **Ưu tiên:** Yêu cầu mới đã chốt qua brainstorming > yêu cầu công ty > quyết định thiết kế/schema hiện có > đề xuất trong spec.

## 1. Mục tiêu

Xây dựng đầy đủ chức năng quản lý đầu sách vật lý: tìm kiếm nhiều điều kiện, xem chi tiết, thêm, sửa, xóa có ràng buộc lịch sử, import CSV từng dòng, kiểm soát quyền, transaction/rollback, test thật và giao diện Admin phù hợp design system đang dùng.

**Ngoài phạm vi:** đặt/giữ sách online, email sẵn sàng nhận, QR/checkout, mượn/trả sách, tính phí phạt thực tế, hình ảnh bìa, bảng `book_copies`, hệ thống thông báo/email mới. Luồng đặt mượn online đã được thảo luận để định hướng tương lai nhưng **không triển khai trong feature này**.

## 2. Nguồn sự thật / trạng thái repo đã xem

- `book/entity/Book.java`: ID `Integer`, `bookCode`, `isbn`, `title`, `author`, `publisher`, `publishedDate`, `totalQuantity`, `availableQuantity`, `borrowFee`, `lateFeePerDay`, `createdAt`, `updatedAt`; Lombok/JPA đã có. **Chưa có `@Version`.**
- `book/repository/BookRepository.java`: `JpaRepository<Book, Integer>` và finder/exists theo `bookCode`, `isbn`; chưa có `JpaSpecificationExecutor`.
- `db/changelog/changes/015-create-books.yaml`: bảng `books`, UNIQUE `book_code`, `isbn`, quantity/fee CHECK, index title/author/published date.
- `loan_items.book_id` đang tham chiếu `books.id`; cần giữ lịch sử, không cascade xóa.
- `role_permissions` đã có `book:read`, `book:create`, `book:update`, `book:delete`, `book:import`; có quản lý quyền động và `PermissionDependencyRegistry`. Không tự thêm dependency giữa các quyền.
- `common/api/ApiResponse.java`, `BusinessException`, `FieldValidationException`, `GlobalExceptionHandler`: API envelope hiện hữu với `success`, `status`, `code`, `message`, `data`, `errors`, `timestamp`; tái sử dụng.
- Member APIs đang dùng `/api/v1/members`, `@PreAuthorize`, status `201` create và `204` delete, `PagedResponse`; frontend có `AdminLayout`, `PermissionGate`, `RequirePermission`, Axios client, Ant Design, trang `/admin/members` để tham khảo.
- `pom.xml`: Spring Boot **4.1.1**, Java **17**; chưa khai báo Apache Commons CSV/Log4j2/Springdoc, vì vậy kiểm tra nhu cầu phụ thuộc ở đúng phase, không tuyên bố chúng đã có.
- Frontend trong thư mục `frontend/` của **cùng repo**; có `DESIGN.md` ở root, `AGENTS.md` có quy tắc Lombok, DB test tách biệt, permission dependency. Không giả định `apps/admin`.

Các đường dẫn/tình trạng trên phải được **đọc lại trên nhánh đang làm** trước khi Agent thực hiện, vì `develop` có thể thay đổi. Không tự sửa phần không liên quan.

## 3. Business decisions — đã chốt qua 24 câu brainstorming

### 3.1 Sách, định danh và tồn kho

- Một record `Book` là **một đầu sách/ấn bản**, sở hữu nhiều cuốn vật lý qua `total_quantity`; chưa quản lý từng copy.
- `book_code`: **server tự sinh tuần tự**, định dạng `B000001`, `B000002`, ... (chữ `B` + số có tối thiểu 6 chữ số, không cắt khi vượt 999999). Dùng cho cả form và CSV; Admin không được nhập/sửa. Phải cấp số an toàn khi nhiều request đồng thời, tận dụng `books.id` auto-increment làm nguồn số (xem §6); `UNIQUE(book_code)` là lớp bảo vệ cuối cùng. Mã có thể có khoảng trống do rollback/xóa; **không cam kết các mã liên tiếp không thiếu số**.
- ISBN không bắt buộc; nhập ISBN-10/ISBN-13, cho phép dấu gạch nối/khoảng trắng trình bày, kiểm tra checksum và chuẩn hóa lưu **ISBN-13**. Chuyển ISBN-10 hợp lệ sang ISBN-13 (prefix 978 + tính lại check digit); ISBN-13 `979...` hợp lệ vẫn giữ ISBN-13 nguyên dạng.
- `title`, `author` bắt buộc; `isbn`, `publisher`, `publishedDate` có thể `null`. Xóa nội dung trường tùy chọn khi sửa phải lưu `null` thật.
- Cho tạo Book với `totalQuantity=0`. Bất biến `0 <= availableQuantity <= totalQuantity`.
- Create: `availableQuantity = totalQuantity`.
- Update: Admin chỉ sửa `totalQuantity`, **không** cho nhập `availableQuantity`. Với tồn kho hiện tại, giữ nguyên lượng đã loại khỏi tồn khả dụng: `unavailable = oldTotal - oldAvailable`; từ chối nếu `newTotal < unavailable`; nếu hợp lệ `newAvailable = newTotal - unavailable`. Không đụng `LoanItem` ở feature này. Thiết kế reservation sau này phải mở rộng định nghĩa `unavailable` chứ không tự trừ tồn hai lần.
- Fee: Admin bắt buộc cung cấp `borrowFee`, `lateFeePerDay`, cả hai cho phép `0`, cấm âm. UI nhập/hiển thị VND như `150.000 ₫`, API/DB dùng **số** (không gửi dấu phân cách); phiên bản đầu ưu tiên giá trị VND nguyên, DB vẫn `DECIMAL(12,2)`.
- Sách giống `title + author` mà **không có ISBN**: **cho thêm sau cảnh báo/xác nhận**, không chặn tự động. Không được nhầm quy tắc này với ISBN UNIQUE.

### 3.2 Search và giao diện

- ADMIN list `GET /admin/books`, detail `/admin/books/:id`; create/edit trong Modal; chưa có ảnh bìa.
- Quick search tìm `bookCode`, ISBN, `title`, `author` (OR giữa các trường); nếu query là ISBN-10 hợp lệ thì chuyển sang ISBN-13 trước khi so khớp ISBN canonical; tìm nâng cao `publisher`, khoảng `publishedDate`, còn sách/hết sách (AND giữa điều kiện với quick search).
- Dùng Spring Data JPA `Specification` / `Pageable`. Tối đa **10 kết quả/trang**, phân trang từ 0 trên API; giới hạn sort field theo whitelist; mặc định `createdAt DESC` và `id DESC` làm tie-breaker ổn định.
- Quick search debounce khoảng 400–500ms; advanced filter chỉ áp dụng khi nhấn **Áp dụng**. Hủy/bỏ qua response cũ để tránh overwrite kết quả mới; đổi bộ lọc reset page về 0.
- UI có loading, empty state, no-results state, lỗi kết nối, validation inline, forbidden, conflict, retry; ẩn/hiện action theo permission thật từ session, backend kiểm tra lại.
- Cảnh báo xóa qua Confirm Modal; khi Book có lịch sử LoanItem, Backend trả **409**; không hard delete và không cascade lịch sử.
- Hai Admin cập nhật cùng Book: dùng **optimistic locking** (`version`), stale update trả 409 và yêu cầu load lại. Không tự ghi đè silently.

### 3.3 CSV

- Chỉ `.csv`, nội dung phải là CSV hợp lệ, **file size < 5 MiB** (`5*1024*1024` bytes), không phải `<=`. Empty file / header thiếu/không hợp lệ bị từ chối. Nên kiểm tra extension + media type khi có ích nhưng **không chỉ tin** `Content-Type`/filename; parse UTF-8 có thể có BOM, CSV escaped quotes/commas chuẩn.
- Cấu trúc header cố định theo tên: bắt buộc `title,author,total_quantity,borrow_fee,late_fee_per_day`; tùy chọn `isbn,publisher,published_date`; không có `book_code` do server tự sinh. Chấp nhận cột tùy chọn không xuất hiện hoặc ô rỗng; ngày `yyyy-MM-dd`; loại bỏ header lạ theo contract (không tự mapping arbitrary).
- **Partial Import**: xử lý tuần tự, dòng hợp lệ lưu; dòng lỗi không khiến các dòng khác rollback. Trùng ISBN trong file: **dòng hợp lệ đầu tiên được lưu**, các dòng sau bị từ chối; cũng kiểm tra trùng DB và đồng thời. **CSV có dòng không ISBN trùng `title + author` với sách không ISBN đã có trong DB hoặc dòng đã import thành công trước đó → từ chối riêng dòng đó**, báo `SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION` (hoặc code tương đương) và hướng dẫn thêm thủ công để xác nhận theo câu 19A. Không tự động ghi đè/update sách cũ. So khớp tên/tác giả sau trim, chuẩn hóa khoảng trắng và không phân biệt hoa/thường. **Kiểm tra tồn tại thông thường không tự ngăn race** khi hai import chạy đồng thời; Phase 03 phải thiết kế và test cơ chế điều phối/khóa an toàn ở bước kiểm tra + ghi hoặc báo rõ hạn chế cần phê duyệt trước khi coi tính năng hoàn tất.
- Kết quả trong Modal: tổng dòng dữ liệu / thành công / thất bại / danh sách số dòng + nguyên nhân; **không cần tải file lỗi**. **File CSV hợp lệ về cấu trúc vẫn trả HTTP 200 cùng report ngay cả khi `importedRows=0` và tất cả dòng dữ liệu đều lỗi**; phản hồi phải ghi rõ 0 sách nhập, không dùng thông báo gây hiểu nhầm đã nhập thành công. File không hợp lệ ở cấp file/header, quá kích thước, không phải CSV, không đọc/parse được toàn file vẫn trả 4xx thích hợp; lỗi hệ thống trả 5xx, không giả báo 200. Bảo vệ chống CSV bất thường, dòng quá dài, excessive error/log size; các giới hạn bổ sung phải rõ và test được, không tùy tiện đặt khiến file <5 MiB hợp lệ bị bác mà không có chính sách.
- Dòng lỗi không được còn bản ghi Book nửa chừng. Không catch DB exception rồi tiếp tục trong cùng transaction rollback-only. Ưu tiên transaction riêng từng dòng qua Spring-managed bean (tránh `@Transactional` self-invocation). Không ghi secrets/nội dung CSV nhạy cảm vào log.

## 4. Kiến trúc và API contract đề xuất (mới, chưa có trên develop)

Luồng: `BookController → BookService / BookImportService / BookQueryService → BookRepository (JPA/Specification) → MySQL`.

Dùng `ApiResponse<T>` hiện hữu, Response DTO thay vì trả Entity. Dùng `PagedResponse<T>` hiện hữu nếu phù hợp; có thể chuyển thành common type nếu có lợi **nhưng không phá Member API**. Tái sử dụng exception handler chuẩn.

| Method/endpoint đề xuất | Mục đích | Authority | Thành công |
|---|---|---|---|
| `GET /api/v1/books` | search/paging | `book:read` | 200 + `ApiResponse<PagedResponse<BookListItem>>` |
| `GET /api/v1/books/{id}` | detail | `book:read` | 200 + `ApiResponse<BookDetail>` |
| `POST /api/v1/books` | create | `book:create` (+ guard Admin) | 201, Location `/api/v1/books/{id}` |
| `PUT /api/v1/books/{id}` | thay thế thông tin có thể sửa | `book:update` (+ guard Admin) | 200 + `BookDetail` |
| `DELETE /api/v1/books/{id}` | hard-delete nếu chưa có history | `book:delete` (+ guard Admin) | 204 (empty body) |
| `POST /api/v1/books/import` | import multipart CSV | `book:import` (+ guard Admin) | 200 + report với file hợp lệ về cấu trúc, kể cả 0 dòng import thành công |

- **PUT** được đề xuất vì Modal sửa gửi đủ các trường editable, cho phép optional field về `null` và tránh nhập nhằng absent vs `null` của PATCH. Version bắt buộc khi update. Không cập nhật `id`, `bookCode`, `availableQuantity`, `createdAt` từ request.
- List query đề xuất: `q, publisher, publishedFrom, publishedTo, availability, page, size, sort` với `availability=ALL|AVAILABLE|UNAVAILABLE`; default `page=0,size=10,sort=createdAt,desc` (cách serialize sort phải nhất quán FE/BE). `publishedFrom <= publishedTo`, parse ISO dates nghiêm, giá trị sort/size/page không hợp lệ trả 400/422 theo chuẩn API hiện có.
- `POST/PUT` Request DTO bao gồm `title,author,isbn?,publisher?,publishedDate?,totalQuantity,borrowFee,lateFeePerDay`; `PUT` thêm `version`; create có cơ chế xác nhận sách tương tự **khi không có ISBN** (ví dụ `confirmSimilar=true`, 409 `SIMILAR_BOOK_CONFIRMATION_REQUIRED` để UI yêu cầu xác nhận, chỉ override cảnh báo trùng title+author). Không cho bypass ISBN/validation.
- `BookDetail` có `id,bookCode,isbn,title,author,publisher,publishedDate,totalQuantity,availableQuantity,borrowFee,lateFeePerDay,createdAt,updatedAt,version`.
- Import đã xử lý (bao gồm toàn bộ dòng lỗi): `HTTP 200`, `ApiResponse.success` và `data={totalRows, importedRows, failedRows, errors:[{rowNumber,field?,code,message}]}`. Dùng code/message trung tính như `BOOK_IMPORT_PROCESSED` / "Đã xử lý file: 0 sách được nhập, N dòng lỗi" khi `importedRows=0`. `totalRows` là số record dữ liệu (không tính header), `rowNumber` định vị bản ghi theo dòng bắt đầu trong file (header = dòng 1), xử lý CSV multiline đúng. **Chỉ lỗi toàn file/request mới trả 4xx**; lỗi hệ thống trả 5xx.
- Http errors: unauthenticated 401; forbidden 403; missing book 404; duplicate ISBN/optimistic conflict/history/similar warning 409; invalid field 422; invalid query/multipart 400 hoặc 422 theo phân loại; unexpected 500 không leak details.
- Phải kiểm tra route ordering (`/import` trước `/{id}` nếu mapping có khả năng xung đột); không trả `200` cho lỗi request/file hoặc lỗi hệ thống. **HTTP 200 all-failed** chỉ có nghĩa server xử lý xong file hợp lệ và trả báo cáo từng dòng, **không** khẳng định có sách được thêm.
- Role/permission: `book:read` có thể dành cho catalog USER về sau, nhưng **Admin UI** cần guard `role != USER` và `book:read`; mutation phải enforce cả authority + vai trò không phải USER như cách Member module đang dùng, không hardcode giả định tất cả Admin có tất cả quyền. Không tự thêm dependency vào `PermissionDependencyRegistry` trước khi xác nhận nghiệp vụ.

## 5. Validation chuẩn schema

| Field | Quy tắc |
|---|---|
| `title` | trimmed nonblank, tối đa 255 ký tự |
| `author` | trimmed nonblank, tối đa 150 ký tự |
| `bookCode` | generated server-side, VARCHAR(30), unique; request không được dùng để thay đổi |
| `isbn` | optional, normalize ISBN-13, checksum, unique nếu nonnull, max schema 20 |
| `publisher` | optional/null, trimmed, max 150 |
| `publishedDate` | optional `LocalDate`/ISO date, null được; không tự thêm rule cấm ngày tương lai nếu chưa chốt |
| `totalQuantity` | integer >=0; khi edit >= số lượng đã unavailable |
| `availableQuantity` | server-managed, invariant `0..total`; không có trong write DTO |
| `borrowFee`, `lateFeePerDay` | required số >=0, tối đa theo `DECIMAL(12,2)`; UI VND nguyên; validation both UI and server |
| `version` | bắt buộc với PUT, optimistic stale check |

Không có `coverImage` hoặc `coverUrl`. Không thay đổi bảng `loans`, `loan_items`, `system_configs`.

## 6. Concurrency / transaction / DB migration

- Liquibase changeset mới **không sửa changeset 015 đã áp dụng**; dự kiến `032-add-books-version.yaml` (chỉ khi đầu nhánh mới vẫn kết thúc 031), add `books.version BIGINT NOT NULL DEFAULT 0`; JPA `@Version Long version`. Naming theo changelog thực tế khi triển khai.
- `@Transactional` ở service ghi dữ liệu; query `@Transactional(readOnly=true)`; rollback thử cả multi-step create/code gen và delete FK race. Có integration test DB thực, không chỉ mock.
- Sinh mã **tuần tự `B000001` theo `books.id` (AUTO_INCREMENT)**, tuyệt đối không dùng `count()+1`/`max(id)+1` vì race. Phương án triển khai phù hợp schema hiện tại: trong **cùng transaction**, insert Book với `book_code` tạm nội bộ duy nhất (<=30 ký tự, do DB yêu cầu NOT NULL/UNIQUE), lấy ID do MySQL cấp, cập nhật thành `B` + ID đệm 0 tối thiểu 6 chữ số, flush trước commit. Đảm bảo mã tạm không bị trả về API và không còn sau commit; rollback cả insert/update khi lỗi. Có thể dùng cơ chế tương đương an toàn mà **không thêm bảng sequence** ngoài schema nếu chứng minh qua integration/concurrency test. Chấp nhận các khoảng trống ID sau rollback/xóa; nếu dữ liệu legacy xung đột định dạng mới, dừng với lỗi rõ ràng/điều tra, không âm thầm ghi đè code cũ.
- Kiểm tra delete history bằng `loan_items`; FK RESTRICT là lớp bảo vệ cuối nếu đang race với tạo mượn; không map `CascadeType.REMOVE` từ Book sang LoanItem. Không biến mọi `DataIntegrityViolationException` thành lỗi lịch sử.
- `@Version` ngăn lost update giữa hai Admin; khi race cùng ISBN/bookCode vẫn dựa vào UNIQUE DB. Với CSV, transaction per row phải thực sự độc lập; giải thích rõ transaction proxy/rollback.

## 7. Frontend/UI

- Thiết kế theo `DESIGN.md`, reuse `AdminLayout`, member list patterns, Axios `apiClient`, `usePermission`, notifications, form validation; không copy nguyên màn hình rồi để logic mock.
- `/admin/books`: toolbar quick search, advanced filters (publisher, date range, còn/hết), count, table (bookCode, title, author, ISBN, total, available, fees, updated), paging 10, sort, các nút Add/Import và row actions theo quyền.
- Modal Add/Edit: required/optional fields, ISBN checks, VND grouped display (`150.000`) nhưng numeric request (`150000`), validation messages, loading/double-submit guard; Edit hiển thị BookCode read-only, version stale alert/refresh.
- `/admin/books/:id`: thông tin đầy đủ và action có quyền; không ảnh bìa. Khi API 409 `BOOK_HAS_LOAN_HISTORY` show thông điệp rõ, không xóa list local.
- Import Modal: lựa file, validate preflight và nhận server report; thống kê + bảng lỗi trong Modal, có thể đóng, retry, chọn lại file; không download error CSV.
- Debounce 400–500ms, abort/cancel stale requests; sort/filter/page state nhất quán; sau mutation refresh current list phù hợp.
- FE là trải nghiệm; Backend là nguồn kiểm quyền thật. Không dùng hardcoded demo/mock để che API đã có.

## 8. Test, logging, docs, coding convention

- Backend: JUnit 5 / Mockito cho logic và Spring Boot + MockMvc/integration MySQL dành cho DB constraints, rollback, race. Test 201/200/204, invalid/missing/boundary, ISBN-10 conversion/checksum, duplicate, 401/403/404/409/422, `version`, inventory, delete history, CSV batch partial, race duplicate, UTF-8 BOM/quotes, file exactly 5 MiB rejected, malformed rows, zero rows, date range, paging>10, sort injection.
- Frontend: Vitest + Testing Library cho permission, filters, debounce stale response, form fee formatting/value numeric, modal behavior, 409 conflicts, CSV report, error/empty/loading states. Build/lint.
- Reuse logging facilities available; kiểm tra chuẩn Log4j2/AOP/console+file theo yêu cầu đào tạo, **không tuyên bố đã có nếu repo chưa triển khai**. Không thêm logging dependency một cách tùy tiện, không log raw JWT/PII/CSV contents; chỉ metadata cần thiết.
- API docs: OpenAPI/Springdoc nếu đã có thì mở rộng, nếu chưa có thì phase 5 đánh giá/bổ sung tương thích Spring Boot 4.1.1, mô tả request/response/error.
- Lombok: `@RequiredArgsConstructor`, `@Slf4j` nếu logging, Getter/Setter có kiểm soát; không `@Data` cho JPA Entity. JavaDoc tiếng Việt ở hàm nghiệp vụ quan trọng nêu **Hàm làm gì → xử lý chính → vì sao/ràng buộc → input/output/exception khi hữu ích**. Chú thích WHY ở transaction/concurrency/CSV/repository query; giải thích annotation lạ khi cần học, không comment getter/câu lệnh hiển nhiên. Giữ tên method/variable rõ nghĩa.

## 9. Chốt bổ sung vòng cuối (câu 22–24) và những việc kỹ thuật cần xác minh

1. **22B — CSV trùng sách không ISBN:** Nếu dòng CSV không có ISBN và trùng `title + author` với sách không ISBN có sẵn (hoặc dòng đã import trước), từ chối **chỉ dòng đó** và nêu lý do; Admin có thể thêm bằng form để xem cảnh báo và xác nhận (giữ câu 19A). Không tự mở modal xác nhận khi import hàng loạt.
2. **23B — Book Code:** Dùng mã tuần tự `B000001`, `B000002`, ... theo `books.id` auto-increment; không dùng `max()+1`, không kỳ vọng không có khoảng trống số. Phải test hai request đồng thời và rollback.
3. **24A — All-failed CSV:** File đúng định dạng mà tất cả dòng dữ liệu lỗi → `200 OK`, `data.importedRows=0`, `data.failedRows=totalRows`, có `errors[]`. Đây là **thành công xử lý file/report**, không phải thành công nhập sách. File hỏng/header không hợp lệ hoặc lỗi hạ tầng vẫn là HTTP lỗi thích hợp.
4. **Việc kỹ thuật cần xác minh khi implement:** kiểm tra Log4j2/AOP/console+file và Springdoc trên `develop` lúc triển khai, tương thích Spring Boot 4.1.1; không tự tuyên bố đã đạt khi chưa test/cấu hình. **Không còn câu hỏi nghiệp vụ 22–24 đang chờ chốt.**

## 10. Phases / Definition of Done

- `spec/PHASE_01_BACKEND_CRUD_VALIDATION.md`: Entity/version/migration, API CRUD, generation, ISBN, inventory, duplicate/similar, delete + tests.
- `spec/PHASE_02_SEARCH_PAGING.md`: JPA Specifications, filter, sort whitelist, pagination, tests.
- `spec/PHASE_03_CSV_IMPORT.md`: multipart CSV partial, per-row transaction, report, negative tests.
- `spec/PHASE_04_FRONTEND_ADMIN.md`: list/detail/modals/permissions/VND/import & UI tests.
- `spec/PHASE_05_INTEGRATION_QUALITY.md`: integration/full tests, OpenAPI/logging verification, regression, final review.

Mỗi phase: đọc spec riêng và `handoff` mới nhất, implement, test thật, self-review, commit **Conventional Commits tiếng Việt** (đúng 1 dòng trống header/body, bullet liền nhau), viết handoff kết quả. **Không push/merge/tạo PR khi chưa có lệnh.** Với lựa chọn setup worktree/branch, xem tài liệu setup và xác nhận theo ý user trước khi thực hiện.
