# DESIGN SYSTEM — LIBBY (SITE ĐỘC GIẢ / USER SITE)

Hệ thống thiết kế độc lập dành riêng cho trang độc giả (**User Site**) của Hệ thống Thư viện số & vật lý.

---

## 1. Triết lý Thiết kế (Design Philosophy)

* **Tên thương hiệu:** `libby.`
* **Slogan định vị:** *"Thư viện online · Mượn trên app · Lấy tại quầy"*
* **Phong cách:** **Modern Bold Graphic & Flat Archival**
  * Tối giản, tương phản cao, nét viền dứt khoát (**2px solid #14112B**).
  * **Tuyệt đối không đổ bóng (zero box-shadow)**: Mọi sự phân tách và nhấn mạnh dựa trên độ tương phản giữa các mảng màu đặc, viền hairline/bold và nền có chủ đích.
  * Tươi sáng, thân thiện, hiện đại nhưng vẫn mang tính kỷ luật và chuẩn xác của một thư viện tri thức.

---

## 2. Bảng Màu Chuẩn (Color Palette & Tokens)

Hệ thống màu sắc của Libby gồm 6 màu nền tảng kết hợp tương phản:

| Tên Token | Mã Hex | Ý nghĩa & Ứng dụng |
|---|---|---|
| **Primary (Violet)** | `#6C4DFF` | Màu thương hiệu chính, nút CTA chính (Chọn mượn, Đặt mượn, Đăng ký), trạng thái active. |
| **Ink (Đen tím than)** | `#14112B` | Màu chữ chính, nền Header độc giả, viền khung 2px, thẻ Dark Card, nút đảo màu. |
| **Lime (Chanh phát quang)** | `#C8FF3D` | Dấu chấm thương hiệu (`libby.`), badge "Còn sách", "Sẵn sàng nhận", số lượng trên giỏ mượn, viền Avatar active. |
| **Lilac (Tím phấn)** | `#EFEBFF` | Nền phụ, nền nút thứ cấp, nền khung chứa QR code, viền phân cách divider nhẹ. |
| **Background (Nền trang)** | `#F4F1FF` | Màu nền toàn bộ website độc giả (dịu mắt, tông tím phấn rất nhẹ). |
| **Card Surface (Nền trắng)** | `#FFFFFF` | Nền các thẻ Card nội dung, Modal, Drawer, ô tìm kiếm. |
| **Subtle Purple (Nền input/field)** | `#F7F5FF` | Nền các ô hiển thị thông tin cá nhân (Profile fields), item trong giỏ mượn. |
| **Error / Out of Stock** | `#FFE4E8` (Nền)<br>`#9B1C31` (Chữ) | Badge "Hết sách", nút hủy, hành động xóa, thông báo lỗi. |
| **Warning / Late / Due** | `#FFF1C2` (Nền)<br>`#7A4B00` (Chữ) | Badge "Sắp đến hạn", "Trễ hạn", cảnh báo thanh toán. |
| **Waitlist Lilac** | `#E3DCFF` (Nền)<br>`#14112B` (Chữ) | Badge "Trong hàng chờ" (Waitlist FIFO). |
| **Muted Text / Secondary** | `#4B4570` | Tên tác giả, nhãn phụ, ngày tháng, thông tin mô tả phụ. |
| **Light Muted Text** | `#C9C3F0` | Chữ phụ trên nền tối Ink (`#14112B`). |

---

## 3. Kiểu Chữ (Typography)

Sử dụng kết hợp 2 font chữ tạo bản sắc riêng biệt:

1. **Bricolage Grotesque (Weight 800):** Dành riêng cho Logo, Tiêu đề lớn, Số liệu nổi bật, Bìa sách đồ họa.
2. **Be Vietnam Pro (Weight 400, 500, 600, 700):** Dành cho toàn bộ nội dung, nút bấm, bảng biểu, thanh điều hướng và nhãn phụ (hỗ trợ hoàn hảo dấu tiếng Việt).

### Thang đo Typography (Typography Scale)

| Cấp bậc | Font | Size | Line Height | Letter Spacing | Weight | Ứng dụng |
|---|---|---|---|---|---|---|
| **Logo Wordmark** | Bricolage Grotesque | 36px - 128px | 1.0 | -0.04em | 800 | Logo `libby.` có chấm chanh `#C8FF3D` |
| **Display 64** | Bricolage Grotesque | 64px | 1.0 | -0.04em | 800 | Tiêu đề trang chính (Khám phá sách, Sách của tôi, Banner) |
| **Heading 40** | Bricolage Grotesque | 40px | 1.0 | -0.03em | 800 | Tiêu đề phân khu, Hero banner mobile |
| **Heading 32** | Bricolage Grotesque | 32px | 1.1 | -0.03em | 800 | Tiêu đề Drawer (Giỏ mượn), Modal (Mã QR) |
| **Title 24 / 22** | Bricolage Grotesque | 22px - 24px | 1.2 | -0.02em | 800 | Tiêu đề nhóm mượn (Yêu cầu L000010), tên sách trong Card |
| **Book Cover Title** | Bricolage Grotesque | 11px - 26px | 1.0 | -0.03em | 800 | Chữ in trên bìa sách phẳng đồ họa |
| **Body 18** | Be Vietnam Pro | 18px | 1.5 | normal | 400 | Phụ đề trang, mô tả ngắn |
| **Body 16** | Be Vietnam Pro | 16px | 1.5 | normal | 400 / 600 | Nội dung chính, chữ trên nút kích thước lớn |
| **Body 15** | Be Vietnam Pro | 15px | 1.4 | normal | 600 | Nút bấm chuẩn, mục menu navigation |
| **Body 14** | Be Vietnam Pro | 14px | 1.4 | normal | 400 / 600 | Tác giả, nhãn thông tin phụ, ô tìm kiếm |
| **Caption 13** | Be Vietnam Pro | 13px | 1.3 | normal | 600 | Nhãn badge, mã sách (B000001), phí trễ/ngày |
| **Micro 12** | Be Vietnam Pro | 12px | 1.0 | normal | 600 | Số đếm trên icon giỏ mượn, nhãn nhỏ mobile |

---

## 4. Hình Khối & Bo Góc (Shapes, Radii & Layout)

* **Quy tắc Bo góc:**
  * **Pill Shape (`border-radius: 9999px` / 22px – 28px):** Nút bấm, ô tìm kiếm, chip phân loại danh mục, huy hiệu đếm giỏ hàng.
  * **Card Shape (`border-radius: 24px` – `28px`):** Card sách, card nhóm mượn, khung hồ sơ người dùng.
  * **Modal Shape (`border-radius: 32px`):** Dialog hiển thị mã QR, popup xác nhận.
  * **Badge Shape (`border-radius: 14px`):** Các nhãn trạng thái (`padding: 4px 12px`).
  * **Book Cover Shape (`border-radius: 12px` – `14px`):** Bìa sách đồ họa.
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
* **Biểu tượng (Icon):** Hình chữ nhật bo góc (`rx="18"`) mang hình cuốn sách lật mở/bookmark có chấm tròn màu Lime (`#C8FF3D`) ở góc trên bên phải.
* **Wordmark:** `libby.` (Bricolage Grotesque 800) với dấu chấm `.` màu Lime.
* **Biến thể:**
  * `dark`: Nền Ink `#14112B`, chữ trắng, chấm Lime.
  * `light`: Nền trắng `#FFFFFF`, chữ Ink, chấm Lime.
  * `violet`: Nền Violet `#6C4DFF`, chữ trắng, chấm Lime.
  * `lime`: Nền Lime `#C8FF3D`, chữ Ink, chấm trắng.

### 5.2. Nút Bấm (`UserButton`)
* **Primary:** Nền Violet `#6C4DFF`, chữ trắng `#FFFFFF`, bo góc pill (24px - 26px).
* **Outline / Secondary:** Nền trong suốt hoặc trắng, viền `2px solid #6C4DFF` hoặc `2px solid #14112B`.
* **Dark CTA:** Nền Ink `#14112B`, chữ trắng `#FFFFFF`.
* **Muted / Disabled:** Nền `#EFEBFF`, chữ `#7A7499`, viền `#EFEBFF`.
* **Lime Accent:** Nền `#C8FF3D`, chữ `#14112B`.

### 5.3. Nhãn Trạng Thái (`UserBadge`)
* `success`: Nền `#C8FF3D`, chữ `#14112B` (*Còn sách*, *Sẵn sàng nhận*).
* `error`: Nền `#FFE4E8`, chữ `#9B1C31` (*Hết sách*, *Đã hủy*).
* `warning`: Nền `#FFF1C2`, chữ `#7A4B00` (*Sắp đến hạn*, *Quá hạn*).
* `waitlist`: Nền `#E3DCFF`, chữ `#14112B` (*Trong hàng chờ*).
* `neutral`: Nền `#14112B`, chữ `#FFFFFF` (*Đang mượn*).
* `preparing`: Nền `#EFEBFF`, chữ `#14112B` (*Đang chuẩn bị*).

### 5.4. Thẻ Sách (`UserBookCard`) & Bìa Sách (`UserBookCover`)
* Bìa sách đồ họa phẳng: chiều cao 170px trên catalog hoặc 76px - 100px trên danh sách mượn.
* 4 gam màu bìa xoay vòng: Violet `#6C4DFF`, Ink `#14112B`, Lime `#C8FF3D`, Lilac `#EFEBFF`.
* Card chứa đầy đủ: Bìa, Tên sách, Tác giả, Giá mượn/lượt, Phí trễ/ngày, Badge tình trạng, Vị trí hàng chờ, Nút hành động ("Chọn mượn", "Vào hàng chờ", "Hết sách").

### 5.5. Thanh Điều Hướng Độc Giả (`UserHeader`)
* Chiều cao 72px, nền Ink `#14112B`.
* Logo `libby.` bên trái.
* Menu chuyển trang: *Khám phá*, *Sách của tôi*, gạch chân màu Lime `#C8FF3D` khi đang ở trang đó.
* Nút Giỏ mượn dạng túi xách (`UserCartButton`) có huy hiệu đếm số lượng sách mượn (nền Lime, viền Ink).
* Avatar độc giả tròn 44px, viền 2px solid `#6C4DFF` hoặc nền Lime `#C8FF3D`, click mở dropdown menu.

### 5.6. Menu Độc Giả (`UserAvatarMenu`)
* Dropdown bo tròn 24px, viền 2px solid `#14112B`.
* Hiển thị Tên & Email độc giả.
* Các liên kết nhanh: *Sách của tôi*, *Hồ sơ của tôi*, divider mỏng, và *Đăng xuất* (màu đỏ).

### 5.7. Giỏ Mượn Slide-out (`UserCartDrawer`)
* Chiều rộng 440px, trượt từ cạnh phải, viền trái `2px solid #14112B`.
* Danh sách các cuốn sách được chọn (tối đa 3 cuốn theo rule hệ thống).
* Hiển thị giá mượn từng cuốn, nút xóa nhanh.
* Chân trang tính "Tổng phí mượn" và nút bấm "Đặt mượn".

### 5.8. Modal Mã QR Nhận Sách (`UserQrModal`)
* Bo góc 32px, viền 2px solid `#14112B`, nền trắng.
* Tiêu đề mã yêu cầu (ví dụ: *Yêu cầu L000010*), tên sách và tác giả.
* Khung nền `#EFEBFF` bo 24px bọc mã QR render sắc nét bằng SVG/Canvas.
* Hướng dẫn: *"Đưa mã này cho thủ thư tại quầy để quét và nhận sách."*

---

## 6. Cấu Hình Ant Design (`ConfigProvider`)

Để Ant Design hoàn toàn hòa hợp với Design System của Libby mà không làm ảnh hưởng đến giao diện Admin:

```ts
import type { ThemeConfig } from 'antd';

export const userAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6C4DFF',
    colorSuccess: '#C8FF3D',
    colorWarning: '#FFF1C2',
    colorError: '#9B1C31',
    colorBgBase: '#FFFFFF',
    colorTextBase: '#14112B',
    fontFamily: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: 24,
    borderRadiusSM: 14,
    borderRadiusLG: 28,
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
    Modal: {
      borderRadiusLG: 32,
      contentBg: '#FFFFFF',
    },
    Drawer: {
      colorBgElevated: '#FFFFFF',
    },
    Badge: {
      borderRadius: 14,
      fontFamily: "'Be Vietnam Pro', sans-serif",
    },
  },
};
```
