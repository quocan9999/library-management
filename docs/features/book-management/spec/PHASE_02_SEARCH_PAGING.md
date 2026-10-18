# PHASE 02 — Search, Specifications, Pagination

**Đầu vào:** Master Spec §§3.2, 4–5, Phase 01 handoff. **Không làm CSV/FE.**

## Mục tiêu
- `GET /api/v1/books` có `book:read`, tìm theo `q` (OR: code, ISBN, title, author), filter AND theo publisher, publishedFrom/to, availability (AVAILABLE/UNAVAILABLE/ALL).
- `BookRepository extends JpaRepository<Book,Integer>, JpaSpecificationExecutor<Book>`; Specification kết hợp predicate, param binding an toàn; không xây SQL bằng nối input.
- Paging `page>=0`, `1<=size<=10`, default size 10; sort whitelist, default createdAt DESC + id DESC tie-breaker; ổn định giữa các trang.
- Không expose Book entity trực tiếp; trả `PagedResponse<BookListItem>` trong ApiResponse, cùng convention Member. Blank `q` = bỏ lọc.

## Acceptance criteria
1. Search đồng thời 4–5 tiêu chí ra đúng dữ liệu; q không phân biệt hoa/thường nếu DB collation cho phép hoặc chủ động lower.
2. Search toàn bộ cùng q: kết quả không trùng, phân trang chính xác; size >10 bị từ chối, không âm thầm bypass.
3. `publishedFrom > publishedTo` lỗi validation; sai format date, unknown sort/availability không gây 500.
4. `book:read` được kiểm tra; Unauthorized/Forbidden đúng status và body.
5. Tests chứng minh limit 10, stable sort, boundary empty / null / special characters / SQL injection-like input.

## Kiến thức/comment
Giải thích `JpaSpecificationExecutor`, `Specification`, `Predicate`, `Pageable`, `Page` và lý do sort field whitelist; JavaDoc giải thích mục đích nghiệp vụ query, không comment `findAll` hiển nhiên.

## Gate
Test + self review + commit riêng + handoff.
