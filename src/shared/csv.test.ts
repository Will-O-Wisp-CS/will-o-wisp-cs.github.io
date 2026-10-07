import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('CSV', () => {
  it('カンマ・改行・ダブルクォートを含むセルを囲む', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('ab')).toBe('ab');
  });

  it('BOM と CRLF が付く', () => {
    expect(toCsv([['a', 'b'], ['1', '2']])).toBe('﻿a,b\r\n1,2\r\n');
  });
});
