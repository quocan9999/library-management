const isbnCharacters = /^[0-9xX\-\s]+$/;

/** VND is displayed with Vietnamese grouping separators; API calls keep the numeric amount. */
export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)} ₫`;
}

export function formatVndInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

export function parseVndInput(value: string): number | null {
  const digits = value.replace(/[.\s]/g, '');
  if (!digits || !/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
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
  if (/^\d{13}$/.test(compact)) {
    const checksum = [...compact.slice(0, 12)].reduce((sum, char, index) => sum + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
    return (10 - (checksum % 10)) % 10 === Number(compact[12]);
  }
  return false;
}
