import { describe, expect, it } from 'vitest';
import { formatVnd, formatVndInput, isValidIsbn, parseVndInput } from '../../features/books/formatting';

describe('book input and display formatting', () => {
  it('groups whole VND amounts for display and parses a numeric API value', () => {
    expect(formatVnd(150000)).toBe('150.000 ₫');
    expect(formatVndInput(150000)).toBe('150.000');
    expect(parseVndInput('150.000')).toBe(150000);
    expect(parseVndInput('0')).toBe(0);
    expect(parseVndInput('')).toBeNull();
    expect(parseVndInput('-1')).toBeNull();
  });

  it.each([
    [0, '0'],
    [150000, '150.000'],
    [1000.50, '1.000,5'],
    [1000.01, '1.000,01'],
  ] as const)('round-trips the fee %s without losing decimals', (amount, text) => {
    expect(formatVndInput(amount)).toBe(text);
    expect(parseVndInput(text)).toBe(amount);
    expect(formatVnd(amount)).toBe(`${text} ₫`);
  });

  it('parses Vietnamese decimal separators without rounding', () => {
    expect(parseVndInput('1.000,50')).toBe(1000.5);
    expect(parseVndInput('1000,01')).toBe(1000.01);
    expect(parseVndInput('0,01')).toBe(0.01);
  });

  it.each(['1,,2', '1,,', '1.000,001', '1.00'])('keeps malformed fee text %j visible for validation', (input) => {
    expect(formatVndInput(input)).toBe(input);
    expect(parseVndInput(input)).toBeNull();
  });

  it('keeps a pending decimal separator and trailing decimal zero while typing', () => {
    expect(formatVndInput('1000,')).toBe('1.000,');
    expect(formatVndInput('1000,50')).toBe('1.000,50');
    expect(formatVndInput(1000.001)).toBe('1.000,001');
    expect(parseVndInput(formatVndInput(1000.001))).toBeNull();
  });

  it.each(['', '-1', '1,001', '1.00', '1.000,', 'text', '1e3', 'NaN', 'Infinity', '1,00,00', '9007199254740992'])(
    'rejects the invalid fee input %j instead of silently changing it', (input) => {
      expect(parseVndInput(input)).toBeNull();
    },
  );

  it('accepts valid ISBN-10 and ISBN-13 and leaves normalization to the server', () => {
    expect(isValidIsbn('0-306-40615-2')).toBe(true);
    expect(isValidIsbn('978-0-306-40615-7')).toBe(true);
    expect(isValidIsbn('978-0-306-40615-8')).toBe(false);
    expect(isValidIsbn('')).toBe(true);
  });
});
