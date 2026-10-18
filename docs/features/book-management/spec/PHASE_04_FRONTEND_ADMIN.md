# PHASE 04 — Frontend Admin Book Management

**Đầu vào:** Master Spec §§3.2,7; Phase 03 handoff, `DESIGN.md`, `frontend/src/components/AdminLayout.tsx`, `frontend/src/features/members`, `frontend/src/auth`, `frontend/src/app/App.tsx`.

## Mục tiêu
- Add route `/admin/books` và `/admin/books/:id` với `RequirePermission('book:read')`, deny USER for Admin screens; menu có `PermissionGate`.
- Danh sách: q debounce 400–500ms, filters publisher/date/availability applied on click, pagination max 10, default sort createdAt DESC, table actions theo `book:*` permissions, states loading/empty/error/retry.
- Create/Edit Modal: form title, author, isbn optional, publisher optional, published date optional, total quantity, borrow fee and late fee required. BookCode readonly ở edit/detail. Không có cover.
- VND: text display `150.000 ₫`, API value numeric 150000, không lưu dấu chấm; trim/title/ISBN validations ở FE nhưng BE là nguồn sự thật.
- Detail page: read-only info, conditionally editable actions, 409 optimistic conflict hướng dẫn reload; 409 history-delete giữ dòng sách và hiển thị lời giải thích.
- Import Modal: file selection/precheck, submit, show success/fail count + row error list (kể cả **HTTP 200 với 0 sách thành công**), hỗ trợ đóng và chọn file mới, không export error file. Với `SIMILAR_BOOK_REQUIRES_MANUAL_CONFIRMATION`, hướng dẫn Admin tạo sách thủ công để xác nhận trùng tên/tác giả, không tự bỏ qua lỗi trong batch.
- Reuse Axios auth-refresh, error mapping, notification, React Hook Form/Zod/Ant Design đang có. Không viết mock cho các API đã triển khai.

## Acceptance criteria
1. Menu và buttons chỉ xuất hiện khi có đúng permission; role USER không thấy Admin book page; route guard và BE 403 phù hợp.
2. Khi typing liên tục, request cũ không overwrite kết quả; filters apply và pagination reset đúng.
3. VND input `150000` hiển thị `150.000` và payload là number, `0` hợp lệ.
4. ISBN-10 được backend normalize và UI hiển thị canonical ISBN-13 sau save; warning duplicate title+author có confirm.
5. UI phản ứng đúng 422 field errors, 409 stale conflict, 409 delete history, 401 refresh flow; không tự cập nhật trạng thái xóa khi server từ chối.
6. File CSV hợp lệ toàn dòng lỗi (200) vẫn mở report, hiển thị `0 sách được nhập` và danh sách lỗi; không phát success-toast sai.
7. Vitest/Testing Library cover UI behavior thực; `npm run lint && npm run build && npm test`.

## Kiến thức/comment
Giải thích các hooks/phương thức xử lý debounce, race cancel, format VND và API boundary tại helper/hook quan trọng; không comment từng JSX.

## Gate
Build/lint/tests + commit + handoff.
