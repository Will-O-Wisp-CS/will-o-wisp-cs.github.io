import type { DayKind } from '../shared/calendar.ts';
import type { AnnounceText } from './announce.ts';

export const WIDTH = 1200;
export const HEIGHT = 675;
/** フォントファイル内の family 名（assets/fonts） */
export const FONT_JP = 'Noto Sans JP';
export const FONT_DIGITS = 'Oswald';

/** 曜日の四角の色。今の告知画像と同じく 土＝青、日＝赤、祝日・平日＝黄 */
export const DAY_COLORS: Record<DayKind, { box: string; text: string }> = {
  sunday: { box: '#dc2626', text: '#ffffff' },
  saturday: { box: '#2563eb', text: '#ffffff' },
  holiday: { box: '#facc15', text: '#111111' },
  weekday: { box: '#facc15', text: '#111111' },
};

/** 元画像（1655×988）を横 1200 に縮めた高さと、上へずらす量 */
const BG_HEIGHT = Math.round((988 * WIDTH) / 1655);
const BG_Y = -20;

const LEFT = 50;
const DATE_BASELINE = 540;
const DATE_SIZE = 130;
/** 日付は横に詰める（参考画像に合わせて横 0.84 倍・字間 -3） */
const DATE_SCALE_X = 0.84;
const DATE_SPACING = -3;
const RECEPTION_SIZE = 70;
const TITLE_BASELINE = 624;
const TITLE_SIZE = 52;
const TITLE_MAX_WIDTH = WIDTH - LEFT * 2;

/** Oswald Bold の文字幅（1000 = 1em） */
const DIGIT_ADVANCE: Record<string, number> = {
  '0': 550, '1': 385, '2': 514, '3': 514, '4': 524, '5': 509, '6': 538, '7': 439, '8': 521, '9': 538, '/': 422, ':': 278, '~': 481,
};

/** 告知画像の SVG。background は背景画像の href（data URI など） */
export function announceSvg(t: AnnounceText, background: string): string {
  const dateWidth = (digitsWidth(t.date, DATE_SIZE) + DATE_SPACING * [...t.date].length) * DATE_SCALE_X;
  const boxSize = 60;
  const boxX = LEFT + dateWidth + 18;
  const boxY = DATE_BASELINE - boxSize;
  const receptionLabelX = boxX + boxSize + 22;
  const receptionX = receptionLabelX + 62;
  const titleSize = Math.min(TITLE_SIZE, Math.floor(TITLE_MAX_WIDTH / textEm(t.title)));

  const day =
    `<rect id="day-box" x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}" fill="${DAY_COLORS[t.dayKind].box}"/>` +
    `<text x="${boxX + boxSize / 2}" y="${boxY + boxSize / 2 + 14}" text-anchor="middle" font-family="${FONT_JP}" font-size="38" fill="${DAY_COLORS[t.dayKind].text}">${esc(t.weekday)}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    '<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="#000" stop-opacity="0"/>',
    '<stop offset="0.55" stop-color="#000" stop-opacity="0.72"/>',
    '<stop offset="1" stop-color="#000" stop-opacity="0.9"/>',
    '</linearGradient></defs>',
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>`,
    `<image x="0" y="${BG_Y}" width="${WIDTH}" height="${BG_HEIGHT}" preserveAspectRatio="none" href="${esc(background)}" xlink:href="${esc(background)}"/>`,
    `<rect y="330" width="${WIDTH}" height="${HEIGHT - 330}" fill="url(#shade)"/>`,
    `<text transform="translate(${LEFT} ${DATE_BASELINE}) scale(${DATE_SCALE_X} 1)" letter-spacing="${DATE_SPACING}" font-family="${FONT_DIGITS}" font-size="${DATE_SIZE}" fill="#ffffff">${esc(t.date)}</text>`,
    day,
    `<text x="${receptionLabelX}" y="${DATE_BASELINE - 2}" font-family="${FONT_JP}" font-size="27" fill="#ffffff">受付</text>`,
    `<text x="${receptionX}" y="${DATE_BASELINE}" font-family="${FONT_DIGITS}" font-size="${RECEPTION_SIZE}" fill="#ffffff">${esc(t.reception)}</text>`,
    `<text id="title" x="${LEFT}" y="${TITLE_BASELINE}" font-family="${FONT_JP}" font-size="${titleSize}" fill="#ffffff">${esc(t.title)}</text>`,
    '</svg>',
  ].join('\n');
}

function digitsWidth(s: string, size: number): number {
  return ([...s].reduce((sum, c) => sum + (DIGIT_ADVANCE[c] ?? 500), 0) * size) / 1000;
}

/** 幅の見積もり（em）: 全角 1、半角 0.6 */
function textEm(s: string): number {
  return [...s].reduce((sum, c) => sum + (c.charCodeAt(0) < 0x2000 ? 0.6 : 1), 0);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
