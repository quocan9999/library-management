# PHASE_05 HANDOFF — Tích hợp giao diện Borrow Book

- **Branch:** `feature/borrow-book`
- **Base develop SHA:** `8c1ae4b3813ea28efb00368259d916a8733cab8a`
- **HEAD commit:** `b98c1c009703b69f68faf2f6e9e3fd9e5d3432a0`
- **Status:** `DONE` — frontend acceptance PHASE_05 đạt.

## 1. Scope thực hiện

- `frontend/src/features/borrow/CatalogPage.tsx`: catalog `/books`, detail `/books/:id`, tìm kiếm/lọc/pagination bằng catalog API.
- `frontend/src/features/borrow/BorrowBookAction.tsx`: xác nhận đặt mượn hoặc vào FIFO waitlist, khóa gửi lặp, thông báo timeout không khẳng định thành công.
- `frontend/src/features/borrow/MyLoansPage.tsx`: `/my-loans`, lọc theo từng LoanItem, QR/reference một lần mỗi Loan, vị trí waitlist, đồng hồ READY 72 giờ chỉ để hiển thị, cancel và renew có xác nhận.
- `frontend/src/features/borrow/LibrarianBorrowRequestsPage.tsx`: `/librarian/borrow-requests`, tra cứu QR bằng paste/máy quét bàn phím, hiển thị thông tin thành viên tối thiểu, cảnh báo PREPARING quá 24 giờ, prepare/READY, hủy READY tại quầy trước khi thu phí, xác nhận danh tính và bàn giao.
- `frontend/src/features/borrow/api.ts`, `types.ts`, `errors.ts`: DTO/API và thông báo lỗi tiếng Việt cho 401/403/409/422, hết hạn, phí không khớp, giới hạn đang mượn và timeout.
- `frontend/src/app/App.tsx`, `frontend/src/components/AdminLayout.tsx`, `frontend/src/styles.css`: route, menu và giao diện responsive trong app hiện có; staff dựa trên permission động, không hardcode roleCode `LIBRARIAN`.
- `frontend/src/tests/borrow/BorrowPages.test.tsx`: kiểm thử route/quyền, API thật qua adapter test, lỗi, loading, timeout, mixed-item, cancel, renew, QR, fee/handover, zero fee và 409.
- `frontend/package.json`, `frontend/package-lock.json`: thêm `qrcode.react` để dựng QR có title accessible. Không thêm backend code, permission, migration hay business table.

## 2. Nghiệp vụ & contract thực tế

- USER chỉ thấy action đặt mượn với quyền `borrow:create`; trang cá nhân giới hạn `USER` và `borrow:read-own`. Server tiếp tục là nơi enforce quyền và nghiệp vụ.
- Catalog gọi `/api/v1/catalog/books`, không dùng API quản trị. Danh sách cá nhân dùng `/api/v1/borrow-requests/mine`; mỗi item được lọc riêng vì một Loan có thể chứa nhiều trạng thái.
- QR chỉ chứa mã nhận yêu cầu để tra cứu, không dùng làm xác thực. Quầy yêu cầu xác minh danh tính riêng. Không tích hợp camera; hỗ trợ nhập/dán mã và máy quét bàn phím.
- Thao tác quầy kiểm tra permission động: prepare, cancel, và đồng thời cả `borrow:handover` + `borrow:fee-confirm`. Request handover chỉ gửi toàn bộ item `READY_FOR_PICKUP` còn lại trong Loan với phí đã chốt, kể cả phí 0; cancel READY có modal riêng trước bước thu phí.
- 409 làm mới trạng thái và đóng xác nhận cũ; fee mismatch/invalid handover cũng đóng xác nhận và yêu cầu đọc lại. Timeout không hiển thị thành công; khi tạo request, UI hướng người dùng tải danh sách trước khi thử lại.
- Không có khác biệt nghiệp vụ/API/schema so với spec. Không sửa `.env`; không chạy DB hoặc integration test trong phase frontend-only này.

## 3. Tests thực chạy

| Lệnh/test | Kết quả PASS/FAIL/NOT RUN | Ghi chú |
|---|---|---|
| `npm run test -- src/tests/borrow/BorrowPages.test.tsx` | PASS, 16/16 | Bộ test Borrow Book riêng |
| `npm run test` | PASS, 302/302, 37/37 files | Thời lượng 338.66 giây; có warning jsdom về `getComputedStyle()` với pseudo-elements ở test hiện hữu |
| `npx eslint src/app/App.tsx src/components/AdminLayout.tsx src/features/borrow src/tests/borrow/BorrowPages.test.tsx` | PASS | Lint toàn bộ file PHASE_05 |
| `npm run lint` | FAIL, 11 lỗi | Các lỗi `react-hooks/purity`/`react-hooks/refs` nằm trong `CheckEmailPage.tsx`, `ForgotPasswordPage.tsx`, `RegisterPage.tsx`, `ResendVerificationForm.tsx`; các file này không nằm trong thay đổi PHASE_05 |
| `npm run build` | PASS | Vite cảnh báo chunk JS 1,565.70 kB sau minify (>500 kB), gzip 483.50 kB |
| `git diff --check` | PASS | Không có whitespace error |
| `mvnw.cmd test` | NOT RUN | Phase chỉ thay frontend; không dùng database ứng dụng hoặc database test trong lần này |

Không có fixture DB ở phase này nên không cần khởi động MySQL test. Backend auth, transaction, rollback và race được kiểm tra ở các phase backend trước.

## 4. Review, bugs, risks

- Tự review xác nhận route và action được giới hạn theo permission hiện hành, staff role là động, QR không thay thế xác minh danh tính, và frontend gửi đúng tập READY/phí đã chốt để backend xử lý atomically.
- Sửa luồng stale-state: 409 ở thao tác thành viên đóng xác nhận cũ sau khi tải lại; lỗi xung đột/phí ở quầy làm mới danh sách và kết quả QR, xóa xác minh cũ trước khi xác nhận lại.
- Lint toàn repo còn 11 lỗi ở 4 trang xác thực có sẵn, ngoài phạm vi phase. Lint scoped và build đều đạt.
- Bundle hiện vượt cảnh báo mặc định 500 kB. Có thể tối ưu code splitting riêng trong công việc frontend sau này; không đổi behavior nghiệp vụ của Borrow Book.
- Quầy dùng nhập/paste QR thay cho camera scan theo spec. Không thêm dependency scanner.
- Không có migration, transaction backend, N+1 query hay thay đổi authorization server trong phase này.

## 5. Git & next phase

- Implementation commit: `b98c1c009703b69f68faf2f6e9e3fd9e5d3432a0` — `feat(borrow): tích hợp giao diện mượn sách`. Handoff đi trong companion docs commit.
- Working tree sạch sau docs commit; không push/merge/PR.
- Phase tiếp theo: đọc `MASTER_SPEC.md`, handoff này và đúng spec PHASE_06 cùng cross-contract được phase đó tham chiếu.
