# Book Management — Spec/Handoff Bundle

Đây là **tài liệu thiết kế**, chưa phải code và chưa triển khai. Phạm vi đúng tính năng quản lý sách dành cho Admin; Borrow/Reservation/Return nằm ngoài.

## Đọc theo thứ tự

1. `MASTER_SPEC.md` — scope, nguồn repo, 24 quyết định đã chốt (bao gồm 22B/23B/24A), API contract đề xuất, business rules và hạng mục kỹ thuật cần xác minh.
2. `spec/PHASE_01_BACKEND_CRUD_VALIDATION.md`
3. `spec/PHASE_02_SEARCH_PAGING.md`
4. `spec/PHASE_03_CSV_IMPORT.md`
5. `spec/PHASE_04_FRONTEND_ADMIN.md`
6. `spec/PHASE_05_INTEGRATION_QUALITY.md`
7. `handoff/HANDOFF_TEMPLATE.md` — checklist và trạng thái thực tế sau mỗi phase.

## Lưu ý trước khi code

- Đọc `MASTER_SPEC.md` mục 9: **22B** CSV skip sách tương tự không ISBN; **23B** mã tuần tự B000001 từ ID an toàn; **24A** CSV toàn dòng lỗi vẫn 200 với báo cáo. Không tự thay đổi các quyết định đã chốt.
- `origin/develop` snapshot 2026-10-16: `e30c32d6daab700ee840874c2f0fe0824670b3f1`. Trước triển khai phải kiểm tra code hiện tại có thay đổi không.
- Code sạch, comment tiếng Việt giải thích hàm **làm gì, xử lý ra sao, tại sao**. Reuse `AGENTS.md`, `DESIGN.md`, `reference/CODING_COMMENT_GUIDELINES.md` đi kèm (không ghi đè file repo).
- Chỉ Liquibase schema migration mới; không sửa changeset 015 cũ; không tự làm Borrow/Reservation.
- Mỗi phase: test thực chất, self review, Conventional Commit tiếng Việt, handoff rồi dừng/tiếp tục theo hướng dẫn.
- **Không push/merge/tạo PR** nếu user chưa yêu cầu.

## Tài liệu setup và prompts

`SETUP_WORKTREE.md` / `PROMPT_SETUP_WORKTREE.txt` / `PROMPT_GOAL.txt` là **mẫu để dùng khi user giao Agent**, không phải lệnh đã được thực thi. Lựa chọn branch-only hay worktree phải được user xác nhận phù hợp task hiện tại, không tự tạo worktree chỉ vì file có sẵn.
