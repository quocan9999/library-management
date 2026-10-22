# PHASE_03 HANDOFF — Staff Prepare, READY, Counter Cancel & Atomic Handover

**Branch:** `feature/borrow-book`
**Base develop:** `8c1ae4b3813ea28efb00368259d916a8733cab8a`
**HEAD trước phase:** `9830656`; implementation PHASE02 `8e9e1aadcf0a5e7fb05a954a9abff2e68cf590c7`.
**Status:** DONE — acceptance PHASE03 đạt, chưa triển khai PHASE04.

## 1. Files

- `src/main/java/sparkminds/librarymanagement/loan/controller/LibrarianBorrowController.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/HandoverRequest.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/StaffBorrowHistoryResponse.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/StaffBorrowResponse.java`
- `src/main/java/sparkminds/librarymanagement/loan/repository/LoanItemRepository.java`
- `src/main/java/sparkminds/librarymanagement/loan/repository/LoanItemStatusHistoryRepository.java`
- `src/main/java/sparkminds/librarymanagement/loan/repository/LoanRepository.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowHandoverService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/StaffBorrowItemService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/StaffBorrowLockService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/StaffBorrowQueryService.java`
- `src/test/java/sparkminds/librarymanagement/integration/loan/BorrowHandoverIntegrationTests.java`
- `src/test/resources/application-test.properties`

## 2. API và logic đã thực hiện

Tất cả route staff nằm dưới `/api/v1/librarian`, cần JWT, role khác USER và permission tương ứng; không hardcode LIBRARIAN hoặc seed staff Role/account.

- GET `/borrow-requests`: phân trang/filter item status/sort whitelist, batch LoanItem/Book/queue; Member chỉ id/memberCode/fullName. `preparingOverdueItemIds` cảnh báo PREPARING quá24h theo updatedAt lúc bắt đầu chuẩn bị, không tự hủy.
- GET `/pickups/{pickupReference}`: lookup riêng tư theo opaque QR; QR không tự authorize. GET `/borrow-requests/{loanCode}/history`: timeline theo item/actor, bounded pagination.
- POST `/borrow-requests/{loanCode}/items/{itemId}/prepare`: RESERVED→PREPARING. POST `.../ready`: PREPARING→READY, readyAt UTC và expiresAt đúng+72h, audit và READY notification PENDING.
- POST `.../cancel`: hủy pending/READY theo yêu cầu USER trước thu phí, audit COUNTER_CANCELLED, giải phóng slot/FIFO atomic; hết hạn409, sau giao/thu phí không hủy. USER cancel-own PHASE02 vẫn dùng được tại quầy.
- POST `.../reject`: RESERVED/PREPARING→REJECTED, reason PHYSICAL_COPY_UNAVAILABLE, không cộng tồn khả dụng giả; không triển khai damaged/Return/refund.
- POST `/borrow-requests/{loanCode}/handover`: bắt buộc borrow:handover AND borrow:fee-confirm; identityVerified=true, expectedLoanVersion, tập IDs đúng toàn bộ READY hiện hành, không thiếu/dư/lặp; amount bằng snapshot từng item, bao gồm0.
- Owner account/email/Role được đọc lại; overdue hoặc lateFee>0 chưa có lateFeePaidAt chặn409, kể cả ADMIN. READY bắt buộc now<expiry; đúng mốc hết hạn từ chối dù scheduler chưa chạy.
- Một transaction ghi paidBorrowFee/paidAt/staff, BORROWED, borrowedAt UTC, dueDate riêng+14, Loan borrowedAt lúc giao lần đầu, aggregate/audit và một HANDOVER intent cho đợt giao. Không trừ kho lần hai, không thay quote; WAITLISTED/RESERVED/PREPARING chưa READY giữ nguyên. Retry sau commit409 không ghi phí/audit lần hai.
- Retry facade PHASE02 giữ transaction/persistence context mới và bounded3. StaffLock tái kiểm tra quyền thật mỗi attempt; khóa owner Account→Member→Books tăng dần, rồi refresh Loan/items. Không khóa Loan trước Book để tránh đảo thứ tự với promotion.
- Không migration, bảng hoặc permission contract mới. Không sửa .env/production DB/config.

## 3. Tests thực và kết quả

| Command | Result |
|---|---|
| `docker compose --profile test up -d --wait mysql-test` | PASS, testDB3308 tmpfs |
| `mvnw.cmd -Dtest=BorrowHandoverIntegrationTests test` trước code |2RED missing routes, `logs/borrow-phase03-routes-red.log`; lượt trước đó fixture sai cột name đã sửa display_name, không dùng làm business evidence |
| Cùng suite sau implementation |2PASS, `logs/borrow-phase03-initial-green.log` |
| Expanded business suite |7PASS, `logs/borrow-phase03-business.log` |
| `mvnw.cmd -Dtest=BorrowHandoverIntegrationTests,BorrowReservationIntegrationTests test` |30PASS(12staff+18reservation), `logs/borrow-phase03-counter-races.log` |
| `mvnw.cmd clean test` lần đầu |361tests,0assertionfail,39errors do MySQL Too many connections; **FAIL**, `logs/borrow-phase03-regression-full.log` |
| `mvnw.cmd clean test` sau giới hạn pool test |**361PASS,0fail/0error/0skip**, `logs/borrow-phase03-regression-final.log` |
| `git diff --check` | PASS |

13stafftests cuối gồm Role động thật, QR401/403/404, USER bị injectstaffpermission vẫn403, staff thiếu từng permission403, account/email và ADMIN không bypass, exactREADY set/subset/duplicate/staleversion, từng fee/negative/zero, cancel2READY giao1, mixed WAITLISTED/PREPARING/READY, deadline đúng biên với Clock cố định, due+14/snapshot, warning24h/reject không tạo tồn, repeated submission, hai race thực(doublehandover,cancelOwn-vs-handover), lỗi audit item thứ hai rollback phí/BORROWED/audit/header thật trong DB.

Full cuối cũng PASS reservation18, BookAdmin27, Member lifecycle12/Query28, RolePermission33 và mọi regression hiện hữu. Không giảm/bỏ test bảo mật để pass.

Nguyên nhân cạn kết nối: nhiều Spring context cache, mỗi Hikari mặc định giữ10 connection. Context7 official HikariCP docs xác nhận minIdle mặc định bằng maxPoolSize. Chỉ cấu hình test classpath maxpool4/minidle0 để tổng pool không vượt MySQL; vẫn đủ hai request race và transaction ngoài. Không tăng MySQL global limit, không sửa production hoặc credentials. Lượt full cuối không còn connection errors.

PHASE03 không đổi migrations; checksum/mapping được xác nhận khi full suite khởi tạo Liquibase. Legacy positive/negative IT đã PASS ở PHASE01 trên fresh tmpfsDB, không chạy lại riêng trên DB đã migrated.

Frontend không đổi: baseline PHASE01 Vitest286/build PASS; lint11 lỗi có sẵn ở4file auth vẫn chuyển PHASE05/06, không tuyên bố feature lint PASS.

## 4. Review, blockers, phase kế

- Self-review: atomic exactREADY/payment, lock order/CAS, UTC/deadline/due, owner eligibility/privacy, dynamic permissions, stock/audit rollback, enum/Lombok/comments tiếng Việt.
- Independent reviewer đọc source/currentphase/sharedcontracts: không finding cần sửa. Reviewer không chạy Maven, kết quả trên do implementer chạy thực.
- Không blocker PHASE03. Exactset thiếu/dư409 theo handover prose/phase03; duplicateIDs422 theo validation (TEST_MATRIX cho409/422). Không đổi permission/API/schema đã chốt.
- Kế tiếp đọc PHASE04 + cross-contract tham chiếu, triển khai renewal/scheduler/email. Chưa đọc PHASE04–06 ở thời điểm handoff này.
- Không worktree mới, không develop coding/push/merge/PR. Không commit logs/credentials; docs/ignored nên force-add đúng handoff.

## 5. Commit

Implementation: `0305275cc212deeb5d855d03aece0efdbac1466f` — `feat(borrow): triển khai chuẩn bị và bàn giao sách tại quầy`. Handoff là companion docs commit; tra git log để tránh tự tham chiếu hash.
