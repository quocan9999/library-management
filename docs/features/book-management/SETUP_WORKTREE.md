# Setup branch / optional worktree — chưa thực hiện

**Mặc định theo project workflow:** có thể dùng worktree độc lập từ `origin/develop`; **nếu user chỉ định không tạo worktree, chỉ tạo feature branch**, phải làm theo chỉ đạo đó.

## Trước khi thao tác
- Xác nhận user muốn **worktree** hay **branch-only**, tên branch, repo gốc và branch base.
- Kiểm tra git status sạch, `git fetch origin`, `git rev-parse origin/develop`; **không** assume snapshot trong spec còn là latest.
- Nếu worktree: tạo worktree riêng từ origin/develop trên `feature/book-management`, đặt env và DB riêng, không chạm repo/DB gốc.
- Nếu branch-only: từ repo đang làm `git switch -c feature/book-management origin/develop` (chỉ khi phù hợp với user và working tree sạch). Không tự động thiết lập DB khác nếu chưa được cho phép.
- Copy giải nén toàn bộ `docs/features/book-management/` vào nơi làm, tránh override tài liệu/repo hiện có.
- `.env` không commit; tuân thủ `AGENTS.md` cách tách MySQL ứng dụng/test, ports và names. Không dùng DB cá nhân/test của worktree khác.
- Sau khi setup: **DỪNG**; không triển khai code, không chạy migration trên DB khác, không push/PR.
