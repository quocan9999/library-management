# Handoff — xử lý lỗi logout frontend

## Nguyên nhân

`AuthContext.logout` trước đây nuốt lỗi từ API và luôn xóa Access Token trong `finally`. Vì vậy frontend chuyển người dùng khỏi Home dù backend chưa xác nhận logout. `HomePage` cũng không có nhánh hiển thị lỗi hoặc retry. `authApi.logout` chấp nhận mọi phản hồi HTTP thành công mà không kiểm tra nội dung API envelope.

## Thay đổi

- Thêm `frontend/src/auth/logout.ts`: chỉ xóa Access Token trong memory sau khi `authApi.logout` hoàn tất; lỗi được truyền lên caller.
- Sửa `frontend/src/auth/AuthContext.tsx`: ủy quyền cho helper và không nuốt lỗi logout.
- Sửa `frontend/src/pages/HomePage.tsx`: hiện Alert khi thất bại, khóa nút trong lúc gửi request và cho phép retry sau khi hoàn tất.
- Sửa `frontend/src/auth/api.ts`: yêu cầu `success === true` và `code === 'AUTH_LOGOUT_SUCCESS'`; response HTTP 2xx không đúng envelope sẽ bị reject.
- Di chuyển `frontend/src/auth/api.test.ts` sang `frontend/src/tests/auth/api.test.ts`, cập nhật imports và thêm test envelope thất bại.
- Thêm `frontend/src/tests/auth/logout.test.ts` để kiểm tra token được giữ trong lúc request pending/thất bại và chỉ bị xóa sau thành công.
- Không thay đổi backend, interceptor hoặc cấu hình `withCredentials`.

## Kiểm tra

- `npm ci`: thành công; thêm 272 packages, audit báo 0 vulnerabilities.
- `npm run test`: thành công — 2 test files, 11 tests passed.
- `npm run lint`: thành công.
- `npm run build`: thành công. Vite tiếp tục cảnh báo một chunk production lớn hơn 500 kB; cảnh báo này cũng có ở baseline trước thay đổi và không thuộc phạm vi issue.

### Browser E2E

- **Chrome DevTools MCP, logout thật:** đăng nhập demo `admin/admin`; logout nhận HTTP `200`, envelope `success: true`, code `AUTH_LOGOUT_SUCCESS`; frontend điều hướng tới `/login`. Reload vẫn ở `/login`, không khôi phục session.
- **Chrome DevTools MCP, Offline:** khi logout request không thể đi qua mạng, Home vẫn hiển thị, Alert `We could not sign you out. Please try again.` xuất hiện và nút retry được bật. Khôi phục mạng rồi retry logout thật thành công và điều hướng tới `/login`.
- **Playwright MCP, HTTP 500 mô phỏng:** route của browser trả HTTP 500 cho request logout mà không chuyển request đó tới backend. Frontend vẫn ở `/`, hiện Alert và bật nút retry. Bỏ route mô phỏng, retry tới backend thật thành công; reload vẫn ở `/login`.

HTTP 500 ở trên là phản hồi được mô phỏng trong browser, không phải lỗi 500 do backend phát ra. Với các trường hợp không nhận được phản hồi thành công, tài liệu này chỉ xác nhận trạng thái frontend chưa được xác nhận; không kết luận backend đã hoặc chưa revoke session/token. Các regression tests xác nhận Access Token trong memory được giữ lại khi helper logout reject.

## Giới hạn còn lại

- Chưa kiểm tra một HTTP 500 phát sinh từ backend thật; trường hợp 500 được mô phỏng ở tầng browser. Lỗi mất kết nối đã được kiểm tra với Chrome DevTools MCP.
- Cảnh báo chunk lớn của Vite có sẵn từ trước và không được xử lý trong issue này.
