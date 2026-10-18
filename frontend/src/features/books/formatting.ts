const isbnCharacters = /^[0-9xX\-\s]+$/;
const feeTextPattern = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
const vndFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 });

/** Hiển thị cả phần lẻ hợp lệ từ API, không làm tròn phí thành số nguyên VND. */
export function formatVnd(value: number): string {
  return `${formatVndInput(value)} ₫`;
}

/** Giữ dấu phẩy đang nhập, số 0 cuối phần lẻ và input sai để form báo lỗi thay vì âm thầm sửa giá trị. */
export function formatVndInput(value: number | string | null | undefined): string {
  if (typeof value === 'string') {
    const text = value.trim();
    const [whole, fraction] = text.split(',');
    const completeText = text.endsWith(',') ? text.slice(0, -1) : text;
    if (parseVndInput(completeText) === null) return value;
    const grouped = vndFormatter.format(Number(whole.replace(/\./g, '')));
    return fraction === undefined ? grouped : `${grouped},${fraction}`;
  }
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return vndFormatter.format(value);
}

export function parseVndInput(value: string): number | null {
  const text = value.trim();
  if (!feeTextPattern.test(text)) return null;
  const [whole, fraction = ''] = text.replace(/\./g, '').split(',');
  // Ghép chuỗi thành đơn vị 1/100 trước để tránh kiểm tra precision bằng phép nhân số thực.
  const hundredths = Number(whole + fraction.padEnd(2, '0'));
  return Number.isSafeInteger(hundredths) ? hundredths / 100 : null;
}

/** Accepts ISBN-10 and ISBN-13 with optional spaces or hyphens; the server canonicalizes them. */
export function isValidIsbn(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!isbnCharacters.test(trimmed)) return false;
  const compact = trimmed.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(compact)) {
    const checksum = [...compact].reduce((sum, char, index) => sum + (char === 'X' ? 10 : Number(char)) * (10 - index), 0);
    return checksum % 11 === 0;
  }
  if (/^(?:978|979)\d{10}$/.test(compact)) {
    const checksum = [...compact.slice(0, 12)].reduce((sum, char, index) => sum + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
    return (10 - (checksum % 10)) % 10 === Number(compact[12]);
  }
  return false;
}
