# PHASE_02 HANDOFF — USER Reservation, FIFO Waitlist & Inventory

**Branch:** `feature/borrow-book`
**Base develop:** `8c1ae4b3813ea28efb00368259d916a8733cab8a` (không thay đổi).
**HEAD trước phase:** `33d44cf`; implementation PHASE01 `068f6c418a8f6956fb616dd649ae276753a843c0`.
**Status:** DONE — acceptance PHASE02 đạt; chưa triển khai PHASE03.

## 1. Files

- `src/main/java/sparkminds/librarymanagement/book/controller/BookCatalogController.java`
- `src/main/java/sparkminds/librarymanagement/book/dto/BookCatalogResponse.java`
- `src/main/java/sparkminds/librarymanagement/book/repository/BookRepository.java`
- `src/main/java/sparkminds/librarymanagement/book/service/BookCatalogService.java`
- `src/main/java/sparkminds/librarymanagement/book/service/BookTransactionService.java`
- `src/main/java/sparkminds/librarymanagement/loan/controller/BorrowRequestController.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/BorrowHistoryResponse.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/BorrowItemResponse.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/BorrowRequestResponse.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/BorrowRequestSummaryResponse.java`
- `src/main/java/sparkminds/librarymanagement/loan/dto/CreateBorrowRequest.java`
- `src/main/java/sparkminds/librarymanagement/loan/entity/Loan.java`
- `src/main/java/sparkminds/librarymanagement/loan/entity/LoanItem.java`
- `src/main/java/sparkminds/librarymanagement/loan/repository/BorrowReadRepository.java`
- `src/main/java/sparkminds/librarymanagement/loan/repository/LoanItemRepository.java`
- `src/main/java/sparkminds/librarymanagement/loan/repository/LoanItemStatusHistoryRepository.java`
- `src/main/java/sparkminds/librarymanagement/loan/repository/LoanRepository.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowAuditService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowCancellationService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowInventoryService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowMemberLockService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowPagination.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowPolicy.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowQueryService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowRequestFilter.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowReservationService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/BorrowRetryExecutor.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/LoanAggregateService.java`
- `src/main/java/sparkminds/librarymanagement/loan/service/LoanTimestampListener.java`
- `src/main/java/sparkminds/librarymanagement/member/repository/MemberRepository.java`
- `src/main/java/sparkminds/librarymanagement/member/service/MemberAccountStatusService.java`
- `src/main/java/sparkminds/librarymanagement/member/service/MemberDeletionTransactionService.java`
- `src/test/java/sparkminds/librarymanagement/integration/loan/BorrowReservationIntegrationTests.java`
- `src/test/java/sparkminds/librarymanagement/integration/member/MemberQueryApiIntegrationTests.java`

## 2. Logic và API thực có

- GET `/api/v1/catalog/books`, `/{id}`: book:read cho tài khoản authenticated, DTO công khai; tái dùng search/paging/sort Book. Admin `/api/v1/books` vẫn chặn USER.
- POST `/api/v1/borrow-requests`: USER + borrow:create,1–3 distinct IDs,201 + Location. Account→Member→Book ID tăng→Loan ID tăng. Lock/refresh trước kiểm tra/mutation; max3 active toàn Member, duplicate title xuyên Loan, overdue, snapshot phí, cap4×total (total0 không nhận queue).
- GET `/api/v1/borrow-requests/mine`: USER + borrow:read-own; filter item statuses trước paging bằng EXISTS, size1–10/sort createdAt whitelist. ALL/PENDING(RESERVED,PREPARING)/HISTORY(RETURNED,CANCELLED,EXPIRED,REJECTED) hoặc tên item status; đây là filter UI, không thêm persisted status.
- GET `/mine/{loanCode}` và `/mine/{loanCode}/items/{itemId}/history`: owner trong query,404 nếu của người khác; batch đọc item/Book/vị trí n/N, history phân trang không lộ actorIDs/pickupReference.
- POST `/mine/{loanCode}/items/{itemId}/cancel`: USER + borrow:cancel-own, hủy WAITLISTED/RESERVED/PREPARING/READY chưa hết hạn và chưa thu phí; không chặn overdue khi giải phóng pending. READY quá hạn409, scheduler phase04 mới thực hiện expiry. Không double release.
- Promotion FIFO timestamp+ID trong Book lock; không skip overdue head, không đổi snapshot phí, không phát email promotion. Các Loan bị ảnh hưởng cập nhật aggregate/version bằng CAS theo ID tăng dần; conflict rollback rồi retry toàn attempt.
- Retry tối đa3 chỉ optimistic errors, REQUIRES_NEW/READ_COMMITTED. Tạm unbind OSIV ngoài transaction và restore finally để attempt sau dùng persistence context mới; test gây stale version thật xác nhận rollback/PC mới/exhaustion409.
- Từng item có immutable audit. Chỉ một REQUEST_CREATED intent PENDING cho cả Loan; cancel có CANCELLED intent PENDING. Không gửi hoặc đánh dấu SENT ở phase02.
- Book admin update giữ API/cover handling; tăng tồn cấp queue trong cùng transaction, giảm không dưới unavailable và không xóa queue.
- Member disable khóa Account→Member, active bất kỳ thì409 trước revoke; closed history cho disable. Member delete khóa Account trước historycheck/delete để tránh deadlock với Borrow, READ_COMMITTED; FK vẫn chặn history insert ngoài luồng Borrow. Book delete history guard giữ nguyên.
- Loan/LoanItem timestamp qua listener với Clock UTC; test đã phát hiện/sửa VM timezone lệch7h, không đổi timezone API cũ toàn app.
- Không migration/schema/permission contract mới ở phase02; không sửa035/036. Không sửa .env, không dùng appDB, không thêm bảng.

## 3. Test commands/results thực

| Command | Result |
|---|---|
| `docker compose --profile test up -d --wait mysql-test` | PASS, testDB3308 tmpfs, root.env hiện tại |
| `mvnw.cmd -Dtest=BorrowReservationIntegrationTests test` trước implementation | RED theo TDD: routes/cancel/stock/disable còn thiếu |
| Cùng suite sau query/history | PASS12, `logs/borrow-phase02-list-green.log` |
| Cùng suite thêm4race | PASS16, `logs/borrow-phase02-races.log` |
| Targeted Borrow+BookAdmin+MemberLifecycle+MemberQuery+RolePermission |117 tests:116 PASS/1FAIL do test cũ cho disable khi còn BORROWED; đã cập nhật theo contract409 và kiểm tra giữ account/history. `logs/borrow-phase02-regression-targeted.log` |
| `mvnw.cmd clean test` bản cuối | **PASS348,0fail/0error/0skip**, `logs/borrow-phase02-regression-full.log` |
| `git diff --check` | PASS |

Borrow suite18 covers catalog/public DTO/search,1/3/4 invalid/duplicate/404 rollback,401/403/owner404, mixed RESERVED+WAITLISTED, fee snapshot/UTC, max3 xuyên Loan, cap/zero total, FIFO/tie/blocked head, cancel mọi pending/double/borrowed/returned/expired409, list/history/paging, disable/session,5real races(lastcopy,max3,stock,disable,delete), real optimistic rollback/new PC/OSIV restore/exhaustion3. Existing Member Query28, lifecycle12, BookAdmin27, RolePermission33 đều PASS trong full build.

Migration phase01 positive/negative IT đã PASS riêng trên fresh tmpfsDB (xem handoff01); phase02 không đổi migration, full build xác nhận checksum/mapping. Không chạy lại standalone legacyIT trên DB đã migrated.

Frontend không đổi: baseline phase01 Vitest286 PASS/build PASS; lint11 lỗi có sẵn ở4file auth, chuyển xử lý phase05/06. Không tuyên bố lint toàn feature PASS.

## 4. Review, blockers, phase kế

- Self-review: lock order, CAS aggregate, audit/stock rollback, owner queries, DTO privacy, enum/Lombok/comments tiếng Việt.
- Independent source review chỉ1finding P2 delete Member ngược lock order; đã sửa và reviewer xác nhận đóng. Full regression giữ FK-history race và thêm delete/create race PASS.
- Không có blocker PHASE02. PHASE03 kế tiếp: chỉ đọc spec phase03 + cross-contract tham chiếu, triển khai staff counter theo contract; không Return full flow/damaged/online payment.
- Không worktree mới, không develop coding/push/merge/PR. Log/credentials không commit. docs/ignored nên force-add đúng handoff.

## 5. Commit

Implementation: `8e9e1aadcf0a5e7fb05a954a9abff2e68cf590c7` — `feat(borrow): triển khai đặt mượn và hàng chờ FIFO`. Handoff là companion docs commit; lấy hash từ git log để không tự tham chiếu hash.
