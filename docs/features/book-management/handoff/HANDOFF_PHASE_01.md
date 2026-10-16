# HANDOFF — Phase 01: Backend CRUD, Validation, Versioning

- Branch / worktree: `feature/book-management`, repository gốc `E:\SparkMinds\library-management`; không dùng worktree.
- HEAD / commit phase: `2897bb9a0eb8c83794d30461691a7dee6119905a` (`feat(book): triển khai CRUD quản lý sách cho Admin`). Bộ spec đã được commit riêng tại `7d1ade9`.
- Đã đọc: `MASTER_SPEC.md`, `spec/PHASE_01_BACKEND_CRUD_VALIDATION.md`, `reference/CODING_COMMENT_GUIDELINES.md`, `handoff/INITIAL_CONTEXT.md`, `AGENTS.md`.
- Tóm tắt thay đổi thực tế: hoàn thành GET detail, POST create, PUT update và DELETE; DTO tách Entity; kiểm tra quyền authority và chặn role USER; chuẩn hóa/kiểm tra ISBN-10/13; cảnh báo sách không ISBN trùng title/author; tính tồn khả dụng theo invariant; optimistic locking; generate bookCode từ `books.id` trong cùng transaction; map FK race khi xóa sang conflict.
- File đã tạo/sửa: Book controller/DTO/service/mapper/rules; `Book.java`, `BookRepository`, `LoanItemRepository`; Liquibase `032-add-books-version.yaml`; unit và MySQL integration tests trong package book.
- API/DB/FE contract thay đổi: thêm các endpoint CRUD ở `/api/v1/books`; không có thay đổi FE trong phase này. Thêm `books.version BIGINT NOT NULL DEFAULT 0` và `@Version Long`; không sửa changeset 015.
- Liquibase changeset ID và tình trạng đã chạy: `032-add-books-version`; được áp dụng khi Spring integration test khởi động trên DB test `library_management_test`. Không dùng DB ứng dụng.
- Tests đã chạy (lệnh, số pass/fail, DB test nào): `docker compose --profile test up -d --wait mysql-test`; `.\mvnw.cmd '-Dtest=BookRulesTests,BookSchemaContractTests,BookAdminApiIntegrationTests' test` — 22 tests pass (17 integration, 5 unit/schema), 0 failures/errors, DB `library_management_test`.
- Tests chưa chạy & lý do: full `mvnw test` regression suite sẽ chạy ở Phase 05 theo kế hoạch; không cần thiết để qua gate riêng của Phase 01.
- Điều kiện nghiệm thu đạt/chưa đạt: các acceptance criteria Phase 01 đã được kiểm tra, bao gồm 201/200/204/401/403/404/409/422, ISBN duplicate và race, code race/rollback, update stale/concurrent, inventory, optional field clear, delete history/FK race. Phase 01 đạt.
- Known bugs/edge cases còn mở: chưa biết lỗi mở trong Phase 01. Toàn bộ full-suite regression và FE/API tích hợp vẫn là việc các phase sau.
- Quyết định pending / yêu cầu user xác nhận: không có.
- Hướng dẫn next phase đọc những file nào: đọc file handoff này và `spec/PHASE_02_SEARCH_PAGING.md`.
