import { describe, expect, it } from 'vitest';
import { formatYen, todayJst } from './format';

describe('formatYen', () => {
  it('3桁区切りと円記号', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567');
    expect(formatYen(0)).toBe('¥0');
  });

  it('マイナスは先頭に付ける', () => {
    expect(formatYen(-5000)).toBe('-¥5,000');
  });
});

describe('todayJst', () => {
  it('JST の日付', () => {
    expect(todayJst(new Date('2026-10-06T15:00:00Z'))).toBe('2026-10-07');
    expect(todayJst(new Date('2026-10-06T14:59:00Z'))).toBe('2026-10-06');
  });
});
