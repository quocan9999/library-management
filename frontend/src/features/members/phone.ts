/** Định dạng số di động Việt Nam theo nhóm 4.3.3 để dễ đọc khi nhập. */
export function formatVietnamPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
}

/** Loại bỏ dấu phân nhóm trước khi gửi số điện thoại lên API. */
export function normalizeVietnamPhone(value: string): string {
  return value.replace(/[.\s-]/g, '');
}
