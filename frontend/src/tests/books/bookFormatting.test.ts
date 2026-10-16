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

  it('accepts valid ISBN-10 and ISBN-13 and leaves normalization to the server', () => {
    expect(isValidIsbn('0-306-40615-2')).toBe(true);
    expect(isValidIsbn('978-0-306-40615-7')).toBe(true);
    expect(isValidIsbn('978-0-306-40615-8')).toBe(false);
    expect(isValidIsbn('')).toBe(true);
  });
});
