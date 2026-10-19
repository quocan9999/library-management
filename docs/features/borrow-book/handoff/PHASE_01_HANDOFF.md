# PHASE_01 HANDOFF — Database, Entity, Permission Foundation

**Branch:** `feature/borrow-book`

**Base develop SHA:** `8c1ae4b3813ea28efb00368259d916a8733cab8a`

**Commit triển khai:** `068f6c418a8f6956fb616dd649ae276753a843c0`

**Status:** `DONE` cho scope PHASE_01; toàn feature còn PHASE_02–06.

## 1. Files và scope thực hiện

- `src/main/resources/db/changelog/changes/035-borrow-foundation.yaml`, `036-borrow-permissions.yaml`, author `quocan9999`; master chỉ append hai include. Không sửa changeset001–034.
- `loan/entity/{Loan,LoanItem,LoanStatus,LoanItemStatus,LoanItemStatusHistory,LoanItemEventReason,NotificationKind,NotificationStatus}.java`: ngày mượn theo item, pickup reference, optimistic version, fee metadata, enum STRING và history. Chỉ thêm một bảng nghiệp vụ; MySQL có16 bảng ứng dụng gồm lock/history, không tính2 bảng Liquibase.
- `loan/service/LoanStatusCalculator.java`: helper thuần tính aggregate theo item,7 tình huống kiểm chứng.
- `member/repository/MemberReadRepository.java`: đọc/sắp xếp ngày lịch sử theo LoanItem, giữ DTO hiện hữu và cho phép ngày NULL trước bàn giao. MemberQueryService/DTO không cần đổi vì đã chuyển tiếp projection nullable.
- `role/policy/{PermissionDependencyRegistry,RoleAccessPolicy}.java`: dependency Borrow đã duyệt và whitelist USER. Frontend dependency đã đọc catalog backend nên không cần sửa registry FE.
- Cập nhật fixture của BookAdminApiIntegrationTests, MemberAdminLifecycleIntegrationTests, MemberQueryApiIntegrationTests; bổ sung case cấp/gỡ quyền vào RolePermissionMutationIntegrationTests và mở rộng mock catalog của test Role.
- Thêm LoanStatusCalculatorTests, BorrowFoundationIntegrationTests, BorrowLegacyMigrationIT, BorrowLegacyPreflightIT và4 changelog/fixture test trong `src/test/resources/db/`.
- Danh sách đầy đủ31 file code/test: `git show --stat 068f6c4`.

## 2. Logic và contract thực tế

- Backfill BORROWED/RETURNED xuống item trước khi drop loan due date; giữ snapshot phí, không tạo bằng chứng thanh toán legacy. Mỗi item có một sự kiện LEGACY_IMPORTED với thời điểm import, không giả tạo lịch sử chuẩn bị.
- Pickup reference UUIDv4 ngẫu nhiên, duy nhất và giữ nguyên mỗi Loan; actor role của history là String động, không enum Role. Business fields history không có setter và không UPDATE qua JPA; delivery metadata có thể cập nhật.
- DB CHECK bảo vệ trạng thái, ngày bắt buộc, ngày trả, renewal0/1, fee-confirmation triple; FK RESTRICT bảo vệ lịch sử. Loan/LoanItem có @Version; Book giữ @Version hiện hữu.
- USER được seed read-own/cancel-own/renew; quyền staff chỉ catalog. Handover phụ thuộc read và fee-confirm; không đổi borrow:create và không seed Role/tài khoản LIBRARIAN.
- Giữ contract Role Management: gỡ quyền cơ sở còn dependency trả400 ROLE_PERMISSION_DEPENDENCY_CONFLICT; Role cuối cùng phải còn ít nhất một quyền. Gỡ handover giữ fee-confirm/read; gỡ cả dependency hợp lệ vẫn giữ quyền không liên quan.
- Preflight035 HALT trước Borrow DDL khi Loan legacy không có item hoặc dữ liệu ngày/trạng thái không hợp lệ; mã chẩn đoán BORROW_LEGACY_DATA_INVALID. Không tự tạo item giả để chữa dữ liệu.
- Không có API Borrow business/FIFO/handover/renew/scheduler mới ở phase này.

## 3. Tests thực chạy

| Lệnh/test | Kết quả cuối | Ghi chú |
|---|---|---|
| `docker compose --profile test up -d --wait mysql-test` | PASS | Service riêng healthy, cổng3308, tmpfs /var/lib/mysql; không gắn volume app |
| `.\mvnw.cmd clean test` | PASS |330 tests,0 failures/errors/skipped; log `logs/borrow-phase01-regression-final.log` |
| `.\mvnw.cmd -Dtest=BorrowLegacyMigrationIT test` | PASS |1 test; DB rỗng001–034 → fixture BORROWED/RETURNED →035–036; chạy lại sau guard vẫn PASS, log `logs/borrow-legacy-final.log` |
| `.\mvnw.cmd -Dtest=BorrowLegacyPreflightIT test` | RED→GREEN/PASS |1 test; trước sửa migration bỏ qua Loan rỗng, sau sửa HALT và giữ due_date; log `logs/borrow-legacy-preflight-green.log` |
| `npm test` trong frontend | PASS |36 files/286 tests; log `logs/borrow-phase01-frontend-test.log` |
| `npm run lint` trong frontend | FAIL có sẵn |11 lỗi React purity/refs tại4 file auth chưa đổi; log `logs/borrow-phase01-frontend-lint.log` |
| `npm run build` trong frontend | PASS | Có cảnh báo bundle trên500kB; log `logs/borrow-phase01-frontend-build.log` |
| `git diff --cached --check` trước commit | PASS | Chỉ làm sạch whitespace ở2 test changelog trước commit; không đổi hành vi |

- Test MySQL8.4.11 thật, Java17, Spring Boot4.1.1, profile test. Datasource dùng đúng MYSQL_TEST_DATABASE/USER/PASSWORD từ .env repo gốc; database library_management_test, khác DB ứng dụng; guard test classpath hoạt động trước Liquibase. Không sửa .env hoặc dùng database app.
- Mỗi migration IT chạy riêng trên service mysql-test được tạo lại rỗng. Test negative tắt auto-Liquibase rồi gọi SpringLiquibase để bắt lỗi preflight; guard datasource vẫn hoạt động. Không chạy hai migration IT cùng một DB đã có fixture.
- Full regression cuối bao gồm Book/Member/Role, auth401/403 hiện hữu, rollback, các race hiện hữu, JPA version stale, CHECK/unique/history/schema và dependency Borrow mới.
- Các lượt RED/intermediate đã sửa: helper/dependency chưa có; CHECK3819 được Spring bọc UncategorizedSQLException nên test kiểm tra chính mã MySQL; test mới giả định sai409 thay vì400 và để Role rỗng. Không đổi contract sản phẩm hoặc bỏ test để pass.
- Một lượt regression đầu bị ảnh hưởng do Maven compile song song chung target; không dùng làm bằng chứng. Các lượt sau chạy Maven tuần tự. MockMvc failure dump đã tắt trong test Role liên quan; token test từng bị dump đã được che trong log/report và quét lại0 JWT Bearer còn giữ.
- Log nằm trong logs/ được gitignore; không commit log hay credentials.

## 4. Review, risks và việc còn mở

- Đã self-review và có reviewer đọc riêng PHASE_01. Finding P2 mất due_date của Loan legacy rỗng đã sửa và kiểm chứng RED→GREEN. Không còn finding backend PHASE_01 cần chặn commit.
- FE không có diff so với HEAD nền: test286 pass/build pass nhưng lint11 lỗi tồn tại tại CheckEmailPage.tsx, ForgotPasswordPage.tsx, RegisterPage.tsx, ResendVerificationForm.tsx. Đây là việc còn mở phải xử lý trước gate frontend/feature cuối; không tuyên bố toàn feature xanh. Không sửa auth FE ngoài scope foundation.
- Reviewer đã đối chiếu các phần không đổi: FE dùng catalog-driven dependency, notification_kind nullableVARCHAR theo contract, HTTP400 dependency conflict hiện hữu; business flows thuộc phase sau.
- MySQL DDL không transactional toàn phần.035 không hứa automatic rollback an toàn sau Borrow traffic; không khôi phục cột bằng dữ liệu giả. Khi HALT cần đối soát dữ liệu legacy trước triển khai, không bypass guard.
- Due/borrowed dates lịch sử giữ nguyên ý nghĩa dữ liệu cũ; không tự đổi timezone hoặc đánh dấu nợ cũ là đã thanh toán. Clock UTC hiện hữu sẽ được tái sử dụng ở business phases.

## 5. Git và phase kế

- Commit code: `068f6c418a8f6956fb616dd649ae276753a843c0` — `feat(borrow): chuẩn bị schema và nền tảng phân quyền mượn sách`.
- File handoff nằm trong commit docs đi kèm; tra commit đó bằng `git log -1 --format=%H -- docs/features/borrow-book/handoff/PHASE_01_HANDOFF.md` để tránh hash tự tham chiếu.
- Không tạo worktree, push, merge hoặc PR. Remote develop đã kiểm tra bằng git ls-remote, vẫn đúng SHA audit.
- Chỉ sang phase kế sau commit handoff: đọc MASTER_SPEC + handoff này + đúng `spec/PHASE_02_USER_RESERVATION_WAITLIST.md` và các cross-contract phase đó tham chiếu. Không đọc PHASE_03–06 trước.
- docs/ được gitignore ở repo: đã chủ động force-add đúng handoff, không force-add toàn bộ tài liệu.
