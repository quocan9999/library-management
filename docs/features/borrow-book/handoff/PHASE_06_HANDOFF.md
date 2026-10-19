# PHASE_06 HANDOFF — Hardening Borrow Book và kiểm thử end-to-end

- **Branch:** `feature/borrow-book`
- **Base develop SHA:** `8c1ae4b3813ea28efb00368259d916a8733cab8a` (không đổi)
- **Implementation commit:** `839e33639825a9a17e59b2f3f8118fefce4d9379`
- **Status:** `DONE` — acceptance PHASE_06 đạt, không có blocker.
- **Phase kế:** Không còn phase Borrow Book; chờ review/quyết định tiếp theo.

## 1. Scope thực hiện

- `src/main/java/sparkminds/librarymanagement/book/controller/BookCatalogController.java`: mô tả catalog API bằng OpenAPI, bao gồm summary, bearer security và response/error schema.
- `src/main/java/sparkminds/librarymanagement/loan/controller/BorrowRequestController.java`: bổ sung mô tả sáu endpoint thành viên, quyền và response/status theo contract đã chốt.
- `src/main/java/sparkminds/librarymanagement/loan/controller/LibrarianBorrowController.java`: bổ sung mô tả endpoint quầy, quyền staff động, tập READY chính xác và hành vi bàn giao/thu phí atomic.
- `src/test/java/sparkminds/librarymanagement/integration/loan/BorrowOpenApiIntegrationTests.java`: kiểm tra đủ 16 route Borrow/catalog, summary, bearer security, request schema và response schema/status.
- `src/test/java/sparkminds/librarymanagement/integration/loan/BorrowHandoverIntegrationTests.java`: thêm hành trình E2E từ đăng ký/xác thực email qua catalog, FIFO, quầy, handover, renew đến reminder; dọn fixture token của tài khoản test.
- `frontend/src/app/App.tsx`, `frontend/src/auth/registrationStorage.ts`, `frontend/src/pages/CheckEmailPage.tsx`, `frontend/src/pages/RegisterPage.tsx`: giữ context cooldown đăng ký là số giây, lưu deadline trong session storage.
- `frontend/src/pages/ForgotPasswordPage.tsx`, `frontend/src/pages/ResendVerificationForm.tsx`, `frontend/src/tests/auth/specialAuthRoutes.test.tsx`: sửa các lỗi React purity/refs trong luồng cooldown và submit để toàn bộ frontend lint đạt; bổ sung assertion route context.

## 2. Nghiệp vụ và contract thực tế

- OpenAPI phản ánh API hiện có; không đổi route, DTO, permission, schema hoặc hành vi nghiệp vụ.
- Hành trình E2E dùng tài khoản đăng ký thật trong test, xác thực token email, tra cứu catalog, tạo Loan gồm 3 sách với một item waitlist, cập nhật tồn kho qua Admin API và xác nhận FIFO.
- Nhân viên quầy dùng Role động cùng permission fixture để tra cứu QR, chuẩn bị và đánh dấu READY. Test hủy một item READY trước bước thu phí, bàn giao toàn bộ READY còn lại với fee đã xác nhận (gồm fee 0), renew miễn phí gần hạn và tạo/dispatch reminder đến trạng thái SENT.
- Không thêm changeset, bảng nghiệp vụ hoặc dependency. Không sửa `.env`; integration tests dùng profile `test` và `library_management_test` trên MySQL test tạm, không dùng database ứng dụng.

## 3. Tests thực chạy

| Lệnh/test | Kết quả | Ghi chú |
|---|---|---|
| `npm run test -- src/tests/auth/checkEmailResend.test.tsx src/tests/auth/forgotPasswordPage.test.tsx src/tests/auth/specialAuthRoutes.test.tsx` | PASS, 23/23 | Test cooldown và route xác thực |
| `npm run test` | PASS, 302/302, 37/37 files | 331.12 giây; jsdom in cảnh báo pseudo-elements hiện hữu, không làm test fail |
| `npm run lint` | PASS | Toàn bộ frontend |
| `npm run build` | PASS | Vite cảnh báo chunk JS 1,565.49 kB sau minify (>500 kB), gzip 483.46 kB |
| `.\mvnw.cmd -Dtest=BorrowOpenApiIntegrationTests test` | PASS, 1/1 | Kiểm tra contract OpenAPI |
| `.\mvnw.cmd "-Dtest=BorrowHandoverIntegrationTests#registeredUserCompletesCatalogFifoCounterHandoverRenewalAndReminderJourney" test` | PASS, 1/1 | Hành trình Borrow E2E nêu trên |
| `.\mvnw.cmd clean test` | PASS, 381/381, 0 failures/errors/skips | MySQL test tạm; changelog chạy từ đầu: 35 changeset thực thi, 1 bị lọc do context mismatch (tổng 36); có regression auth/book/member/role/borrow |
| `docker compose --profile test rm -sf mysql-test` + `docker compose --profile test up -d --wait mysql-test`; `.\mvnw.cmd -Dtest=BorrowLegacyMigrationIT test` | PASS, 1/1 | Reset test container; xác minh migrate dữ liệu legacy |
| Cùng reset test container; `.\mvnw.cmd -Dtest=BorrowLegacyPreflightIT test` | PASS, 1/1 | Test xác nhận Liquibase từ chối fixture legacy vi phạm precondition |
| `git diff --check` | PASS | Không có whitespace error; Git có cảnh báo chuyển LF→CRLF cho controller Java theo cấu hình working tree |

Không có test nào `NOT RUN` trong acceptance PHASE_06. Log SpringDoc/Open-in-view và cảnh báo chunk/jsdom không ảnh hưởng kết quả.

## 4. Review, bugs, risks

- Tự review xác nhận các annotation OpenAPI giữ nguyên security/contract hiện hành; test đọc tài liệu sinh ra thay vì chỉ kiểm tra annotation.
- Hành trình E2E kiểm tra integration thật trên MySQL test cho FIFO, hủy READY trước fee, handover tập READY với fee chính xác, renew và reminder. Regression/full suite và hai fixture migration đều đạt.
- Lint fix chỉ điều chỉnh hiển thị/đếm cooldown ở các trang auth hiện hữu và wrapper submit; backend vẫn là nguồn quyết định cooldown và validation.
- Không có migration hoặc thay đổi cấu hình DB. Không có blocker còn lại.
- Bundle frontend vượt ngưỡng cảnh báo mặc định 500 kB; tối ưu code splitting chưa thuộc scope Borrow Book.

## 5. Git và kết thúc phase

- Implementation commit: `839e33639825a9a17e59b2f3f8118fefce4d9379` — `test(borrow): hoàn thiện kiểm thử tích hợp và tài liệu API`. Handoff nằm trong companion docs commit.
- Phase cuối của Borrow Book đã hoàn tất; working tree sẽ sạch sau docs commit.
- Không push, merge hoặc tạo PR.