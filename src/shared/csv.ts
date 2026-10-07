/** CSV のセル。カンマ・改行・ダブルクォートを含むときは囲む */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Excel でそのまま開けるよう BOM 付き・CRLF 改行の CSV にする */
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((cells) => cells.map(csvCell).join(',') + '\r\n').join('');
}
