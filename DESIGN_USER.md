# DESIGN SYSTEM — LIBBY (SITE ĐỘC GIẢ / USER SITE)

Hệ thống thiết kế độc lập dành riêng cho trang độc giả (**User Site**) của Hệ thống Thư viện số & vật lý.

---

## 1. Triết lý Thiết kế (Design Philosophy)

* **Tên thương hiệu:** `libby.`
* **Slogan định vị:** *"Thư viện online · Mượn trên app · Lấy tại quầy"*
* **Phong cách:** **Modern Bold Graphic & Flat Archival**
  * Tối giản, tương phản cao, nét viền dứt khoát (**2px solid #14112B**).
  * **Tuyệt đối không đổ bóng (zero box-shadow)**: Mọi sự phân tách và nhấn mạnh dựa trên độ tương phản giữa các mảng màu đặc, viền dứt khoát và nền có chủ đích.
  * Tươi sáng, thân thiện, hiện đại nhưng vẫn mang tính kỷ luật và chuẩn xác của một thư viện tri thức.

---

## 2. Bảng Màu Chuẩn (Color Palette & Tokens)

Hệ thống màu sắc của Libby được phân tách rõ ràng giữa màu nền tảng/thương hiệu và màu trạng thái/chữ phụ:

### 2.1. Màu Nền tảng & Thương hiệu (Brand & Surface Colors)

| Tên Token | Mã Hex | Ý nghĩa & Ứng dụng |
|---|---|---|
| **Primary (Violet)** | `#6C4DFF` | Màu thương hiệu chính, nút CTA chính (Chọn mượn, Đặt mượn), trạng thái active. |
| **Ink (Đen tím than)** | `#14112B` | Màu chữ chính, nền Header độc giả, viền khung chính 2px, thẻ Dark Card, nút đảo màu. |
| **Lime (Chanh phát quang)** | `#C8FF3D` | Dấu chấm thương hiệu (`libby.`), badge "Còn sách", "Sẵn sàng nhận", số lượng trên giỏ mượn, Avatar độc giả. |
| **Lilac (Tím phấn)** | `#EFEBFF` | Nền phụ, nền nút thứ cấp, nền khung chứa QR code, viền phân cách divider nhẹ. |
| **Background (Nền trang)** | `#F4F1FF` | Màu nền toàn bộ website độc giả (dịu mắt, tông tím phấn rất nhẹ, tương phản với card trắng). |
| **Card Surface (Nền trắng)** | `#FFFFFF` | Nền các thẻ Card nội dung, Modal, Drawer, ô tìm kiếm. |
| **Subtle Purple (Nền input/field)** | `#F7F5FF` | Nền các ô hiển thị thông tin cá nhân (Profile fields), item trong giỏ mượn. |

### 2.2. Màu Trạng thái & Chữ phụ (Semantic & Typography Tokens)

| Tên Token | Mã Hex | Ứng dụng trong giao diện |
|---|---|---|
| **Error / Out of Stock** | `#FFE4E8` (Nền)<br>`#9B1C31` (Chữ) | Badge "Hết sách", nút xóa, hành động nguy hiểm, thông báo lỗi. |
| **Warning / Late / Due** | `#FFF1C2` (Nền)<br>`#7A4B00` (Chữ) | Badge "Sắp đến hạn", "Trễ hạn", cảnh báo thanh toán. |
| **Waitlist Lilac** | `#E3DCFF` (Nền)<br>`#14112B` (Chữ) | Badge "Trong hàng chờ" (Waitlist FIFO). |
| **Preparing Lilac** | `#EFEBFF` (Nền)<br>`#4B4570` (Chữ) | Badge "Đang chuẩn bị", "Đang chờ duyệt". |
| **Text Primary (Ink)** | `#14112B` | Màu chữ tiêu đề, nội dung chính trên nền sáng. |
| **Text Muted / Secondary** | `#4B4570` | Tên tác giả, nhãn phụ, ngày tháng, thông tin mô tả phụ. |
| **Text Light Muted** | `#C9C3F0` | Chữ phụ, ngày tạo trên nền tối Ink (`#14112B`). |
| **Text Disabled** | `#7A7499` | Chữ trên nút hoặc nhãn ở trạng thái vô hiệu hóa. |
| **Antd Success (Toàn cục)** | `#1F7A3A` | Token `colorSuccess` của Ant Design (đảm bảo độ tương phản chữ/icon trên nền trắng theo WCAG). |
| **Antd Warning (Toàn cục)** | `#B26A00` | Token `colorWarning` của Ant Design (đảm bảo độ tương phản chữ/icon trên nền trắng theo WCAG). |

---

## 3. Kiểu Chữ (Typography)

Sử dụng kết hợp 2 font chữ tạo bản sắc riêng biệt, nạp trực tiếp qua Google Fonts API đúng cú pháp trục `opsz,wght`:

```css
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap');
```

1. **Bricolage Grotesque (Weight 700, 800):** Dành riêng cho Logo, Tiêu đề lớn, Số liệu nổi bật, Bìa sách đồ họa.
   * **Chuỗi font dự phòng:** `'Bricolage Grotesque', 'Be Vietnam Pro', sans-serif;`. Nếu xảy ra lỗi mạng hoặc ký tự đặc biệt, phông chữ sẽ rơi về **Be Vietnam Pro** (hỗ trợ toàn diện dấu tiếng Việt) thay vì font hệ thống mặc định.
2. **Be Vietnam Pro (Weight 400, 500, 600, 700):** Dành cho toàn bộ nội dung, nút bấm, bảng biểu, thanh điều hướng và nhãn phụ.
   * **Chuỗi font dự phòng:** `'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;`.

### Thang đo Typography (Typography Scale)

| Cấp bậc | Font | Size | Line Height | Letter Spacing | Weight | Ứng dụng |
|---|---|---|---|---|---|---|
| **Logo Wordmark** | Bricolage Grotesque | 26px - 104px | 1.0 | -0.04em | 800 | Logo `libby.` có chấm chanh `#C8FF3D` |
| **Display 64** | Bricolage Grotesque | 64px (mobile 38px) | 1.0 | -0.04em | 800 | Tiêu đề trang chính (Khám phá sách, Sách của tôi, Banner) |
| **Heading 40** | Bricolage Grotesque | 40px (mobile 28px) | 1.1 | -0.03em | 800 | Tiêu đề phân khu, Hero banner |
| **Heading 32** | Bricolage Grotesque | 32px | 1.15 | -0.03em | 800 | Tiêu đề Drawer (Giỏ mượn), Modal (Mã QR) |
| **Title 24 / 22** | Bricolage Grotesque | 22px - 24px | 1.2 | -0.02em | 800 | Tiêu đề nhóm mượn (Yêu cầu L000010), tên sách trong Card |
| **Book Cover Title** | Bricolage Grotesque | 11px - 26px | 1.0 | -0.03em | 800 | Chữ in trên bìa sách phẳng đồ họa |
| **Body 18** | Be Vietnam Pro | 18px | 1.5 | normal | 400 | Phụ đề trang, mô tả ngắn |
| **Body 16** | Be Vietnam Pro | 16px | 1.5 | normal | 400 / 600 | Nội dung chính, chữ trên nút kích thước lớn |
| **Body 15** | Be Vietnam Pro | 15px | 1.4 | normal | 600 | Nút bấm chuẩn, mục menu navigation |
| **Body 14** | Be Vietnam Pro | 14px | 1.4 | normal | 400 / 600 | Tác giả, nhãn thông tin phụ, ô tìm kiếm |
| **Caption 13** | Be Vietnam Pro | 13px | 1.3 | normal | 600 | Nhãn badge, mã sách (B000001), phí trễ/ngày |
| **Micro 12** | Be Vietnam Pro | 12px | 1.0 | normal | 700 | Số đếm trên icon giỏ mượn, nhãn nhỏ mobile |

---

## 4. Hình Khối, Bo Góc & Bố Cục (Shapes, Radii & Layout)

* **Quy tắc Bo góc:**
  * **Pill Shape (`border-radius: 9999px` / 22px – 28px):** Nút bấm, ô tìm kiếm, Select, DatePicker (cao 48px), chip phân loại danh mục, huy hiệu đếm giỏ hàng.
  * **Text Area Shape (`border-radius: 20px`):** Ô nhập nhiều dòng `Input.TextArea` bo 20px thay vì pill 9999px để giữ form chữ nhật thanh thoát.
  * **Card Shape (`border-radius: 24px` – `28px`):** Card sách (24px), card nhóm mượn (28px), khung hồ sơ người dùng (28px).
  * **Modal Shape (`border-radius: 32px`):** Dialog hiển thị mã QR, popup xác nhận.
  * **Badge Shape (`border-radius: 14px`):** Các nhãn trạng thái (`padding: 4px 12px`).
  * **Book Cover Shape (`border-radius: 12px` – `14px`):** Bìa sách đồ họa (danh mục phẳng 0px, card nhỏ bo 12–14px).
  * **Subtle Field Shape (`border-radius: 16px`):** Các ô dữ liệu chi tiết trong trang Hồ sơ cá nhân.
* **Quy tắc Viền & Bóng:**
  * Viền chính: `2px solid #14112B` (tạo độ sắc sảo, retro-modern, dứt khoát).
  * Viền phụ / Divider: `1px solid #EFEBFF`.
  * **Không đổ bóng:** Tuyệt đối tránh `box-shadow` mờ nhạt; dùng lớp nền tương phản để nổi khối.
  * Lớp phủ Modal/Drawer: `background: rgba(20, 17, 43, 0.38)` kết hợp `backdrop-filter: blur(6px)`.
* **Hệ thống Spacing (Bội số 4px):**
  * `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `28px`, `32px`, `40px`, `48px`, `56px`, `64px`.

---

## 5. Danh Mục Component (Component Catalog)

### 5.1. Brand & Logo (`LibbyLogo`)

Biểu tượng gồm hình khối vuông bo góc (`rx="18"`) mang dấu trang sách lật và chấm tròn điểm nhấn Lime (`#C8FF3D`). Các biến thể được thiết kế chuyên biệt tùy theo **màu nền hiển thị**:

* **`dark` (dùng TRÊN nền tối, ví dụ Header `#14112B`):**
  * Khối icon: nền Violet `#6C4DFF`, hình sách trắng `#FFFFFF`, chấm Lime `#C8FF3D`.
  * Chữ `libby`: màu trắng `#FFFFFF`, dấu chấm `.` màu Lime `#C8FF3D`.
* **`light` (dùng TRÊN nền sáng, ví dụ Nền trắng `#FFFFFF` hoặc Nền trang `#F4F1FF`):**
  * Khối icon: nền Violet `#6C4DFF`, hình sách trắng `#FFFFFF`, chấm Lime `#C8FF3D`.
  * Chữ `libby`: màu Ink `#14112B`, dấu chấm `.` màu Lime `#C8FF3D`.
* **`violet` (dùng TRÊN nền tím thương hiệu `#6C4DFF`):**
  * Khối icon: nền trắng `#FFFFFF`, hình sách tím `#6C4DFF`, chấm Lime `#C8FF3D`.
  * Chữ `libby`: màu trắng `#FFFFFF`, dấu chấm `.` màu Lime `#C8FF3D`.
* **`lime` (dùng TRÊN nền chanh điểm nhấn `#C8FF3D`):**
  * Khối icon: nền Ink `#14112B`, hình sách chanh `#C8FF3D`, chấm trắng `#FFFFFF`.
  * Chữ `libby`: màu Ink `#14112B`, dấu chấm `.` màu trắng `#FFFFFF`.

### 5.2. Nút Bấm (`UserButton`)

Tất cả nút bấm mặc định có `type="button"`, bo tròn dạng Pill, hỗ trợ các biến thể:

* **`primary`:** Nền Violet `#6C4DFF`, chữ trắng `#FFFFFF`, viền `2px solid #6C4DFF`.
* **`outline`:** Nền trắng `#FFFFFF`, chữ Violet `#6C4DFF`, viền `2px solid #6C4DFF`.
* **`dark`:** Nền Ink `#14112B`, chữ trắng `#FFFFFF`, viền `2px solid #14112B`.
* **`dark-outline`:** Nền trong suốt, chữ Ink `#14112B`, viền `2px solid #14112B`.
* **`lime-outline`:** Nền trong suốt, chữ Lime `#C8FF3D`, viền `2px solid #C8FF3D`.
* **`lime-accent`:** Nền Lime `#C8FF3D`, chữ Ink `#14112B`, viền `2px solid #14112B`.
* **`muted`:** Nền Lilac `#EFEBFF`, chữ xám tím `#7A7499`, viền `2px solid #EFEBFF` (trạng thái vô hiệu hóa).
* **`ghost`:** Nền trong suốt, chữ Ink `#14112B`, không viền.

### 5.3. Nhãn Trạng Thái (`UserBadge`)

Bo góc chuẩn 14px, padding `4px 12px`, font `Be Vietnam Pro` weight 600:

* **`success`:** Nền `#C8FF3D`, chữ `#14112B` (*Còn sách*, *Sẵn sàng nhận*, *Mã nhận sách*).
* **`error`:** Nền `#FFE4E8`, chữ `#9B1C31` (*Hết sách*, *Đã hủy*).
* **`warning`:** Nền `#FFF1C2`, chữ `#7A4B00` (*Sắp đến hạn*, *Quá hạn*).
* **`waitlist`:** Nền `#E3DCFF`, chữ `#14112B` (*Trong hàng chờ*).
* **`neutral`:** Nền `#14112B`, chữ `#FFFFFF` (*Đang mượn*).
* **`subtle`:** Nền `#EFEBFF`, chữ `#14112B` (*Đang chờ duyệt*).
* **`preparing`:** Nền `#EFEBFF`, chữ `#4B4570` (*Đang chuẩn bị*).
* **`outline`:** Nền trong suốt, chữ `#14112B`, viền `2px solid #14112B`.

### 5.4. Thẻ Sách (`UserBookCard`) & Bìa Sách (`UserBookCover`)

* Bìa sách đồ họa phẳng: chiều cao 170px trên catalog, hoặc 56px - 100px trên danh sách giỏ/mượn.
* **Viền bìa cỡ nhỏ (`size="sm" | "md" | "lg"`):** Bổ sung viền `2px solid #14112B` bo tròn theo thẻ (`border-radius: 12px` – `16px`) giúp ảnh bìa có nền sáng/trắng (như Effective Java) tách biệt rõ ràng, không bị chìm hay hòa vào nền hàng của giỏ mượn và danh sách.
* **Ảnh bìa mặc định:** Khi sách chưa có ảnh bìa (admin không tải lên ảnh bìa, `coverImageUrl` rỗng hoặc `null`), mặc định sử dụng ảnh Cloudinary: `https://res.cloudinary.com/dcz9x5e9/image/upload/v1792744188/defbookcover-min_lbjfkz.jpg`.
* **Cơ chế fallback:** Tự động hiển thị ảnh bìa từ URL thật; nếu không có hoặc link ảnh lỗi thì nạp ảnh bìa mặc định; nếu vẫn lỗi thì rơi về bìa typographic đồ họa với 4 gam màu xoay vòng (Ink `#14112B` + chữ Lime; Violet `#6C4DFF` + chữ Trắng; Lime `#C8FF3D` + chữ Ink; Lilac `#EFEBFF` + chữ Ink).
* Card chứa đầy đủ: Bìa, Tên sách (tối đa 2 dòng), Tác giả, Giá mượn/lượt, Phí trễ/ngày, Badge tình trạng, Vị trí hàng chờ, và Nút hành động tương ứng:
  * "Chọn mượn" (`primary`): khi sách còn khả dụng.
  * "Vào hàng chờ" (`outline`): khi sách hết nhưng còn slot chờ FIFO.
  * "Hết sách" (`muted`): khi đã hết toàn bộ số lượng và slot chờ.
  * "Đã trong giỏ" (`outline`): khi cuốn sách đã nằm trong giỏ mượn. **Khi độc giả bấm nút này, hệ thống sẽ mở trực tiếp Drawer giỏ mượn** (`openCart`) thay vì gọi lại `addToCart` (tránh báo cảnh báo trùng sách).

### 5.5. Thanh Điều Hướng Độc Giả (`UserHeader`)

* Chiều cao 72px, nền Ink `#14112B` trải dài toàn màn hình.
* Khung nội dung bên trong giới hạn `max-width: 1280px`, căn giữa với lề hai bên 40px (mobile 20px).
* **Menu chính:** Duy nhất một liên kết điều hướng **"Khám phá"** (có gạch chân Lime `#C8FF3D` khi đang ở trang sách). Mục "Sách của tôi" được chuyển vào menu Avatar để tinh gọn thanh điều hướng.
* Nút Giỏ mượn dạng túi xách (`UserCartButton`) có huy hiệu đếm số lượng sách mượn (nền Lime, viền Ink).
* Avatar độc giả hình tròn 44px, nền Lime `#C8FF3D`, chữ cái đầu của tên độc giả:
  * Khi menu đang mở: viền `2px solid #6C4DFF`.
  * Khi menu đóng: viền `2px solid #C8FF3D` (đồng màu với nền).

### 5.6. Menu Độc Giả (`UserAvatarMenu`)

* Popup bo tròn 24px, viền `2px solid #14112B`, nền trắng, sử dụng API `popupRender` của Ant Design Dropdown.
* Hiển thị Tên & Email độc giả.
* Các liên kết:
  * **Sách của tôi:** Có nền `#EFEBFF` cố định khi đang ở route `/my-loans`.
  * **Hồ sơ của tôi:** Có nền `#EFEBFF` cố định khi đang ở route `/profile`.
  * Đường phân cách mỏng `#EFEBFF`.
  * **Đăng xuất:** Chữ đỏ `#9B1C31`, hover nền `#FFE4E8`.

### 5.7. Giỏ Mượn Slide-out (`UserCartDrawer`)

* Chiều rộng 440px (trên màn hình nhỏ co giãn chiếm gần hết chiều ngang: `max-width: calc(100vw - 20px)`), trượt từ mép phải với animation ~200ms ease-out.
* Lớp phủ mờ (Backdrop): `rgba(20, 17, 43, 0.38)` kết hợp `backdrop-filter: blur(6px)`.
* **Hành vi đóng:** Nút X, click vùng mờ backdrop, hoặc nhấn phím `Escape`.
* **Khóa cuộn & Focus Trap:**
  * Effect quản lý phụ thuộc duy nhất vào `[open]`, lưu callback `onClose` vào `useRef` (`onCloseRef`). Nhờ đó, khi danh sách thay đổi (ví dụ độc giả xóa một sách khỏi giỏ), focus không bị nhảy đột ngột về nút Đóng và `document.body.style.overflow` không bị giật mở/khóa lại.
  * Tự động focus vào nút Đóng khi mở, giữ vòng lặp phím Tab/Shift+Tab trong drawer, khôi phục focus về nút đã bấm mở sau khi đóng.
* **Giới hạn 3 đầu sách:**
  * Tiêu đề kèm mô tả: `"Tối đa 3 đầu sách cho mỗi lượt mượn trực tuyến."`
  * Khi độc giả cố thêm sách thứ 4: hiển thị thông báo cảnh báo qua `message.warning('Mỗi lượt mượn trực tuyến tối đa 3 đầu sách')` và **không tự mở drawer**.
  * Khi độc giả thêm cuốn sách đã có trong giỏ: hiển thị `message.warning('Sách này đã có trong giỏ mượn')` và **không tự mở drawer**.
* **Trạng thái giỏ trống:** Hiển thị icon túi mượn, dòng thông báo "Giỏ mượn chưa có sách nào" và lời hướng dẫn.
* Chân trang tính "Tổng phí mượn" và nút bấm "Đặt mượn".

### 5.8. Modal Mã QR Nhận Sách (`UserQrModal`)

* Bo góc 32px, viền `2px solid #14112B`, nền trắng, hiệu ứng fade + scale nhẹ (0.96 $\rightarrow$ 1).
* Có nhãn Lime "Mã nhận sách" (`UserBadge success`) ngay phía trên tiêu đề yêu cầu (ví dụ: *Yêu cầu L000010*).
* Khung nền Lilac `#EFEBFF` bo 24px chứa mã QR kích thước **260px** render bằng SVG sắc nét.
* Đầy đủ hành vi đóng qua Esc, click vùng mờ, khóa cuộn trang nền và quản lý focus.

### 5.9. Chip Lọc Tình Trạng (`UserFilterChips`)

* **Mục đích:** Bộ lọc trạng thái dạng nút bấm pill bo tròn, sử dụng trong các thanh công cụ (ví dụ lọc danh mục sách theo tình trạng bản sách).
* **Cấu trúc & ARIA:**
  * Bọc ngoài bằng thẻ `<div role="group" aria-label={ariaLabel}>`.
  * Mỗi lựa chọn là một thẻ `<button type="button" aria-pressed={isSelected}>`, áp dụng class `user-pressable`.
* **Kích thước & Quy cách hiển thị:**
  * Chiều cao nút 44px, padding ngang `0 20px`, bo tròn Pill (`9999px`), chữ 14px weight 600.
  * Khoảng cách giữa các chip: `10px`.
* **Trạng thái:**
  * **Chưa chọn:** Nền trắng `#FFFFFF`, viền `2px solid #14112B`, chữ `#14112B`.
  * **Đang chọn:** Nền đen Ink `#14112B`, viền `2px solid #14112B`, chữ trắng `#FFFFFF`.
  * **Focus bàn phím:** Vòng focus nổi bật theo theme `:focus-visible` (`3px solid #6C4DFF`, offset `2px`).
* **Khả năng tương thích thiết bị nhỏ (<=480px):**
  * Tự động chuyển thành hàng cuộn ngang (`overflow-x: auto`, `flex-wrap: nowrap`, ẩn thanh cuộn scrollbar), không bị rớt dòng và không làm vỡ bố cục trên màn hình điện thoại.

---

## 6. Bổ Sung Các Quy Tắc Bố Cục Đặc Thù (Layout Rules)

### 6.1. Quy tắc Nền trang & Khối nội dung
* Thân trang luôn mang nền tím phấn dịu mắt: `#F4F1FF`.
* Tất cả các khối thẻ nội dung chính nổi bật trên nền trang bằng màu trắng `#FFFFFF`, bao quanh bởi đường viền dứt khoát `2px solid #14112B`.
* Header đen `#14112B` tách biệt rõ rệt khỏi thân trang, không có viền thừa.

### 6.2. Card Yêu Cầu Mượn (Loan Request Card)
* Header card: dải trên cùng mang class `.user-loan-card__header` nền đen `#14112B`, chữ trắng, hiển thị mã yêu cầu (`Yêu cầu L000010`) và ngày tạo. Có nút bấm "Hiện mã QR" viền Lime trong suốt (`variant="lime-outline"`).
* Thân card: nền trắng, chứa danh sách các cuốn sách trong lượt mượn.
* Khoảng cách giữa các card yêu cầu mượn: `32px`.

### 6.3. Tab Trạng Thái Dạng Pill (Status Filter Tabs)
* Trạng thái chưa chọn: nền trắng `#FFFFFF`, viền đen `2px solid #14112B`, chữ đen, bo tròn dạng Pill (chiều cao 44px, padding `0 20px`).
* Trạng thái đang chọn: nền đen `#14112B`, viền đen `2px solid #14112B`, chữ trắng.

### 6.4. Bố cục Trang Hồ Sơ (Profile Layout)
* Bố cục 2 cột (trên desktop):
  * **Cột trái (320px):** Thẻ đen Ink `#14112B` bo góc 28px, chứa Avatar lớn 96px nền Lime, Họ tên (Bricolage Grotesque 28px), Email và Badge "Độc giả".
  * **Cột phải:** Các thẻ trắng viền `2px solid #14112B` bo góc 28px (Thông tin cá nhân, Tài khoản & bảo mật).
  * **Các ô thông tin chi tiết:** Nền `#F7F5FF` bo góc 16px, padding `14px 18px`.

---

## 7. Khả Năng Tiếp Cận & Tương Thích (Accessibility & Responsiveness)

* **Hiển thị Focus bàn phím (`:focus-visible`):**
  * Trên thân trang: viền nổi `3px solid #6C4DFF`, offset `2px`.
  * Trên Header nền đen: viền nổi `3px solid #C8FF3D`, offset `2px`.
  * Trong Popup menu Avatar (`.user-avatar-popup`): viền nổi `3px solid #6C4DFF`, offset `2px`.
  * Trong Dải đen trên đầu Card yêu cầu mượn (`.user-loan-card__header`): viền nổi `3px solid #C8FF3D`, offset `2px`.
  * Tuyệt đối không dùng inline style `outline: none` để đảm bảo trình duyệt hiển thị vòng focus cho người dùng bàn phím.
* **Tiêu chuẩn ARIA:**
  * Drawer và Modal mang thuộc tính `role="dialog"`, `aria-modal="true"`, `aria-labelledby` trỏ tới tiêu đề `<h2>`.
* **Giảm thiểu chuyển động (`prefers-reduced-motion`):**
  * Tự động vô hiệu hóa transition và animation biến đổi tỉ lệ/trượt khi hệ điều hành kích hoạt chế độ hạn chế chuyển động.
* **Responsive Breakpoints:**
  * **Desktop (>768px):** Container tối đa `1280px`, padding lề 40px, hiển thị đầy đủ menu điều hướng và cấu trúc 2 cột.
  * **Tablet / Mobile chuẩn (<=768px):**
    * Header giảm lề đệm còn 20px, khoảng cách giữa các phần tử 16px.
    * Tiêu đề lớn giảm kích thước (`Display 64` $\rightarrow$ 38px, `Heading 40` $\rightarrow$ 28px).
    * Giỏ mượn mở rộng chiếm gần hết màn hình (`calc(100vw - 20px)`).
  * **Màn hình nhỏ (<=480px, như 390px, 360px):**
    * Tự động ẩn liên kết văn bản "Khám phá" trong `.user-header__inner` (Logo `libby.` đóng vai trò liên kết trực tiếp về `/books`).
    * Lề đệm Header giảm còn 16px, khoảng cách giữa các nút 10-12px.
    * Đảm bảo tuyệt đối không bị tràn ngang ở các kích thước 390px và 360px.

---

## 8. Cấu Hình Ant Design (`ConfigProvider`)

Hòa hợp hoàn hảo với hệ thống Libby thông qua `userAntdTheme.ts` và `userTheme.css`:

```ts
import type { ThemeConfig } from 'antd';

export const userAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6C4DFF',
    colorSuccess: '#1F7A3A',
    colorWarning: '#B26A00',
    colorError: '#9B1C31',
    colorBgBase: '#FFFFFF',
    colorTextBase: '#14112B',
    fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: 12,
    borderRadiusSM: 8,
    borderRadiusLG: 16,
    lineWidth: 2,
    colorBorder: '#14112B',
  },
  components: {
    Button: {
      borderRadius: 9999,
      controlHeight: 48,
      fontWeight: 600,
      fontFamily: "'Be Vietnam Pro', sans-serif",
      defaultBorderColor: '#14112B',
      defaultColor: '#14112B',
      primaryShadow: 'none',
    },
    Input: {
      borderRadius: 9999,
      controlHeight: 48,
      colorBorder: '#14112B',
      activeBorderColor: '#6C4DFF',
      hoverBorderColor: '#6C4DFF',
    },
    Select: {
      controlHeight: 48,
      borderRadius: 9999,
      colorBorder: '#14112B',
      activeBorderColor: '#6C4DFF',
      hoverBorderColor: '#6C4DFF',
    },
    DatePicker: {
      controlHeight: 48,
      borderRadius: 9999,
      colorBorder: '#14112B',
      activeBorderColor: '#6C4DFF',
      hoverBorderColor: '#6C4DFF',
    },
    Modal: {
      borderRadiusLG: 32,
      contentBg: '#FFFFFF',
    },
    Drawer: {
      colorBgElevated: '#FFFFFF',
    },
    Card: {
      borderRadiusLG: 24,
    },
    Badge: {
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
    Tabs: {
      colorPrimary: '#6C4DFF',
      itemSelectedColor: '#14112B',
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
  },
};
```

> **Lưu ý riêng về TextArea:** `Input.TextArea` của Ant Design được CSS `userTheme.css` ghi đè `border-radius: 20px !important;` và `padding: 12px 18px !important;` (bỏ `height: auto !important` để cơ chế `autoSize` tính toán chiều cao tự động theo số dòng văn bản vẫn hoạt động trơn tru).
```
