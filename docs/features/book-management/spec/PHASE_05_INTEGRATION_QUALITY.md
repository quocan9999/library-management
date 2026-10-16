# PHASE 05 — Integration, Security, Quality, Documentation

**Đầu vào:** Master Spec §§4–8; toàn bộ handoff 01–04; baseline develop mới nhất để tránh regressions.

## Mục tiêu
- Kiểm tra end-to-end API ↔ FE, DB MySQL thật và dữ liệu test riêng; xác minh test negative/concurrency/integrity không chỉ mock.
- Xác minh use case thêm/sửa/xóa/search/CSV/import, permission (401/403), optimistic stale (409), duplicate (409), validation (422), paging 10, tính tồn kho, delete loan history.
- Kiểm tra Liquibase pending version migration, không thay schema gốc trực tiếp, `ddl-auto=none`.
- Logging theo yêu cầu training: kiểm tra cấu hình thật của toàn repo cho Log4j2 + console/file + AOP; bổ sung phần còn thiếu trong scope hợp lý nếu chưa có, tương thích Spring Boot 4.1.1, không log secrets/PII/CSV content. Không nhận đã đạt nếu chưa chạy và chưa cấu hình.
- Springdoc OpenAPI/API doc với schemas, sample requests, success/errors; verify Swagger UI hoạt động với security khi thật sự được cấu hình.
- Self review query perf (N+1), transaction rollback, exception translation, race delete/history, CSV Row corruption, auth bypass, constraint; check file rác, secrets, config, outdated comment.

## Test matrix tối thiểu
- CRUD: 201/200/204/404, required/blank/too-long, ISBN-10/13 valid-invalid, duplicate title warn, duplicate ISBN, q=0, fees 0/negative/overflow, old/new inventory.
- Concurrency: 2 Admin cùng version; cùng ISBN; 2 create đồng thời sinh book code B... riêng, rollback không lộ mã tạm, gap số không bị coi là lỗi; hai import đồng thời với cùng sách không ISBN phải được kiểm thử quy tắc phát hiện trùng; delete khi loan history được tạo đồng thời.
- Search: 4–5 combined conditions, AND/OR, date bounds, page/size, arbitrary sort rejected, consistent sort.
- CSV: 0/1/N rows, partial, duplicate within file & DB, **không ISBN trùng title+author skip đúng dòng**, toàn bộ dòng lỗi **HTTP 200 report 0 imported**, malformed/header toàn file trả 4xx, bytes strict <5MiB, UTF-8 BOM, multiline, transaction per-row.
- FE: permissions/menu/guard, stale query, disabled submit, form handling, VND, conflict/retry, CSV errors and accessible states.
- Regression: Login/Refresh, Member, Role permission flows vẫn xanh trên branch và test DB riêng.

## Definition of done
1. Kết quả test/build/lint và điều kiện chạy được lưu trong handoff; nếu không chạy, nêu rõ.
2. Không có blocker/security/data-integrity findings còn mở.
3. API contract & error codes documented; logging redaction và OpenAPI thực sự kiểm tra.
4. Commits riêng từng phase đã tồn tại; **không tự push/merge/PR**.
5. Ghi handoff cuối ghi rõ thay đổi, tests, known limitations và điểm cần người dùng review.
