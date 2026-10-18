# HANDOFF — Phase 02: Search, Specifications, Sorting, Pagination

- Branch / repository: `feature/book-management`, repository gốc `E:\SparkMinds\library-management`; không dùng worktree.
- Commit phase: `2191567d6d4e7207f75fbb71e7ca3208faf62ef3` (`feat(book): thêm tìm kiếm và phân trang sách`).
- Đã đọc trong phase: `spec/PHASE_02_SEARCH_PAGING.md`, `reference/CODING_COMMENT_GUIDELINES.md` và `handoff/HANDOFF_PHASE_01.md`; đã tham khảo tài liệu Spring Data JPA qua Context7.
- Tóm tắt thay đổi: thêm `GET /api/v1/books` cho Admin với quick search OR trên bookCode/ISBN/title/author và filter AND theo publisher, ngày xuất bản, availability. ISBN-10 hợp lệ được chuẩn hóa trước khi tìm. Truy vấn dùng `JpaSpecificationExecutor`/Criteria API, không nối input vào SQL; paging giới hạn size 1–10; sort dùng whitelist và luôn thêm `id DESC` để ổn định tie.
- Response: `ApiResponse<PagedResponse<BookListItemResponse>>`; không trả trực tiếp JPA Entity. `PagedResponse` được chuyển từ package Member sang `common.api`, giữ nguyên các field và JSON contract hiện tại của Member.
- File chính đã tạo/sửa: `BookController`, `BookRepository`, `BookMapper`, `BookListItemResponse`, `BookQueryService`, `BookSearchCriteria`, `BookSpecifications`, `common/api/PagedResponse`; cập nhật import `PagedResponse` ở Member; thêm `BookSearchApiIntegrationTests`.
- Database/Liquibase: không có thay đổi schema hoặc changeset trong Phase 02.
- Tests mới nhất: `docker compose --profile test up -d --wait mysql-test`; `.\mvnw.cmd '-Dtest=BookSearchApiIntegrationTests' test` — 7 tests pass, 0 failures/errors, chạy trên `library_management_test`.
- Regression đã chạy trước assertion test cuối: `.\mvnw.cmd '-Dtest=BookRulesTests,BookSchemaContractTests,BookAdminApiIntegrationTests,BookSearchApiIntegrationTests,MemberQueryApiIntegrationTests' test` — 57 tests pass, 0 failures/errors; đã xác nhận MemberQuery không đổi contract sau khi chuyển `PagedResponse`.
- Tests chưa chạy: full backend suite `mvnw test` được để dành cho Phase 05 theo kế hoạch.
- Acceptance: các tiêu chí Phase 02 đạt: quyền `book:read` và chặn role USER, tìm OR, filter AND, ISBN-10, blank query, paging/page limit, stable sorting, literal special characters, injection-like input và lỗi query trả 400.
- Known issues / quyết định pending: không có vấn đề hoặc quyết định nghiệp vụ đang chờ. Full-suite regression và tích hợp frontend/API còn ở các phase sau.
- Hướng dẫn phase tiếp theo: đọc handoff này và `spec/PHASE_03_CSV_IMPORT.md`; không cần đọc lại toàn bộ tài liệu.
