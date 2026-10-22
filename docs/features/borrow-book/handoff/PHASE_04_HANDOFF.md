# PHASE_04 HANDOFF — Gia hạn, scheduler và email

**Branch:** `feature/borrow-book`

**Base develop SHA:** `8c1ae4b3813ea28efb00368259d916a8733cab8a`

**HEAD trước phase:** `c45fb6d`

**Status:** `DONE` — acceptance PHASE04 đạt.

## 1. Scope thực hiện

- Thêm `POST /api/v1/borrow-requests/mine/{loanCode}/items/{itemId}/renew`, request có `expectedItemVersion`, chỉ USER có `borrow:renew`.
- Gia hạn BORROWED một lần, miễn phí +7 ngày từ due date hiện tại; cửa sổ inclusive từ due−3 đến due, từ chối nếu quá hạn hoặc có WAITLISTED.
- Scheduler hết hạn READY tại `now >= pickupExpiresAt`, giải phóng tồn và gọi allocator FIFO trong cùng transaction; reminder theo ba ngày UTC đã chốt.
- Delivery đọc intent từ `loan_item_status_history`, claim lease có thế hệ retry, backoff bounded, giới hạn 5 lần; staff history hiển thị trạng thái/mã lỗi an toàn.
- Files mới: `BorrowRenewalResponse`, `RenewBorrowRequest`, `BorrowRenewalService`, `BorrowExpirationService`, `BorrowReminderService`, `BorrowSystemItemLockService`, `BorrowNotificationKeys`, `BorrowNotificationRepository`, `BorrowNotificationDeliveryService`, `BorrowNotificationDispatcher`, `BorrowNotificationMailSender`, `BorrowSchedulingConfiguration`, `BorrowSchedulingConfigurationTests`, `BorrowRenewalSchedulerIntegrationTests`.
- Files sửa: `BorrowRequestController`, `BorrowReadRepository`, `LoanItemRepository`, `LoanItemStatusHistoryRepository`, `StaffBorrowHistoryResponse`, `StaffBorrowQueryService`, `application-test.properties`.
- Không thêm migration, bảng, permission hay API ngoài renewal đã duyệt. Không đổi `.env`.

## 2. Nghiệp vụ & contract thực tế

- Renew khóa Account→Member→Book, refresh item/version và kiểm tra queue dưới cùng Book lock với enqueue/promotion; cập nhật due date, renewal count, audit cùng transaction. Reminder due cũ được supersede khi renew commit.
- Scheduler chạy expiration/reminder và delivery riêng; test profile tắt borrow background jobs để fixtures chỉ đổi bởi test. Production scheduler dùng hai worker để SMTP không giữ worker bảo trì.
- Claim được commit trước SMTP. Delivery dùng transaction riêng để cùng khóa Account→Member→Book và intent trong khi gửi; renew đã lấy khóa trước sẽ supersede và loại reminder cũ, còn renew đến sau chờ delivery hoàn tất. Lỗi SMTP rollback transaction delivery rồi lưu mã lỗi và lịch retry riêng, không rollback nghiệp vụ đã commit.
- SMTP và DB không thể commit nguyên tử: nếu SMTP đã nhận nhưng process chết trước khi SENT commit, có thể gửi trùng khi retry; guarantee là at-least-once. Lỗi cuối cùng hiển thị `DELIVERY_ATTEMPTS_EXHAUSTED`.
- Không mail PREPARING hoặc queue promotion. Mỗi item có notification key reminder theo item+due date+kind; query candidate bỏ key đã tạo để batch sau không bị đói.

## 3. Tests thực chạy

| Lệnh/test | Kết quả PASS/FAIL/NOT RUN | Ghi chú |
|---|---|---|
| `docker compose --profile test up -d --wait mysql-test` | PASS | MySQL test 8.4, cổng test 3308, dữ liệu tmpfs |
| `mvnw.cmd -Dtest=BorrowRenewalSchedulerIntegrationTests,BorrowSchedulingConfigurationTests,BorrowHandoverIntegrationTests test` | PASS, 31/31 | `logs/borrow-phase04-inflight-fix-final.log`; gồm 16 renewal/scheduler/email, 2 scheduler config, 13 handover regression; có barrier SMTP-vs-renew |
| `mvnw.cmd clean test` | PASS, 379/379, 0 fail/error/skip | `logs/borrow-phase04-regression-final.log`, 5:43 phút |
| `git diff --check` | PASS | Chỉ có cảnh báo quy ước LF→CRLF trên một số file Windows |

Integration tests dùng `@ActiveProfiles("test")`, database `library_management_test` do `.env` worktree cấu hình và MySQL test tmpfs; không chạy trên application database. Không đưa credential vào log/handoff.

## 4. Review, bugs, risks

- Review độc lập tìm thấy race reminder đang gửi và renew; đã khắc phục bằng Account→Member→Book/intent lock xuyên suốt delivery và thêm barrier test. Reviewer xác nhận thứ tự khóa và không thấy finding actionable còn lại.
- Lượt tích hợp trước đó báo 1 lỗi assertion vì test còn mong đợi SMTP chạy ngoài transaction. Assertion đã cập nhật để xác nhận claim commit trước, sau đó SMTP chạy trong delivery transaction riêng; suite 31/31 và regression 379/379 đều PASS.
- At-least-once có thể tạo email trùng ở cửa sổ SMTP đã nhận nhưng process/DB chưa ghi SENT. Không có guarantee exactly-once với SMTP.
- Delivery transaction giữ Account/Member/Book và history row trong lúc SMTP; timeout SMTP hiện là 5 giây. Điều này tuần tự hóa renew/send và có thể khiến thao tác cùng account/book chờ tối đa theo timeout.
- Không đổi schema; PHASE04 không cần migration. Test DB đã có 35 changeset; full suite xác nhận cấu hình/mapping hiện hành khớp schema.

## 5. Git & next phase

- Implementation đã commit, handoff đi trong companion docs commit. Working tree sạch sau commit; không push/merge/PR.
- Tiếp theo đọc MASTER_SPEC, handoff này, đúng spec PHASE05 và cross-contract của nó; đọc `DESIGN.md` khi triển khai FE.

**Implementation commit:** `46a6b7d` — `feat(borrow): triển khai gia hạn và nhắc hạn trả sách`.
