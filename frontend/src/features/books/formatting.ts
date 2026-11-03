const isbnCharacters = /^[0-9xX\-\s]+$/;
const feeTextPattern = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
const vndFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 });

/** Hiển thị cả phần lẻ hợp lệ từ API, không làm tròn phí thành số nguyên VND. */
export function formatVnd(value: number): string {
  return `${formatVndInput(value)} ₫`;
}

/**
 * Định dạng tiền tệ VND khi người dùng nhập hoặc hiển thị từ API.
 * Tự động nhóm dấu chấm (.) sau mỗi 3 chữ số khi gõ số tiền (ví dụ: 1000 -> 1.000, 20000 -> 20.000, 150000 -> 150.000).
 * Giữ nguyên phần dấu phẩy (,) thập phân đang gõ và các ký tự không hợp lệ để form báo lỗi thay vì âm thầm xóa.
 */
export function formatVndInput(value: number | string | null | undefined): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return vndFormatter.format(value);
  }
  if (typeof value !== 'string') return '';

  const text = value.trim();
  if (!text) return '';

  // Nếu có nhiều hơn 1 dấu phẩy thì chuỗi không hợp lệ -> giữ nguyên để validator xử lý
  const parts = text.split(',');
  if (parts.length > 2) return value;

  const [whole, fraction] = parts;
  // Loại bỏ tất cả dấu chấm phân cách hàng nghìn cũ trước khi nhóm lại
  const rawWhole = whole.replace(/\./g, '');

  // Nếu phần nguyên có ký tự không phải số (ví dụ dấu trừ, chữ cái) -> giữ nguyên để validator báo lỗi
  if (!/^\d*$/.test(rawWhole)) return value;

  // Nếu có phần thập phân mà chứa ký tự không phải số -> giữ nguyên để validator báo lỗi
  if (fraction !== undefined && !/^\d*$/.test(fraction)) return value;

  // Định dạng lại phần nguyên theo chuẩn tiếng Việt với dấu chấm phân cách hàng nghìn
  let grouped = '';
  if (rawWhole !== '') {
    const num = Number(rawWhole);
    if (!Number.isSafeInteger(num)) return value;
    grouped = vndFormatter.format(num);
  } else if (fraction !== undefined) {
    grouped = '0';
  }

  return fraction === undefined ? grouped : `${grouped},${fraction}`;
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
