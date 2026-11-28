/**
 * スガツールのイベントのカバー画像（1200×675）を作る。Node 専用。
 *
 *   node .claude/skills/sugatool-cover/cover.ts [YYYY-MM-DD] [出力フォルダ]
 *
 * 日付を省くと JST の明日。その日の鬼火CS（events.json と events-archive.json）を1件1枚にする。
 * 背景は background.png（文字なし）。文字の位置・大きさは見本（2026-11-28 竜星のPAO秋葉原ロケット無線店）に合わせてある。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { dayKind } from '../../../src/shared/calendar.ts';
import { mergeEventLists, type ScheduleEvent } from '../../../src/shared/events.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const require = createRequire(join(root, 'package.json'));

function tomorrowJst(): string {
  const jst = new Date(Date.now() + 9 * 3600_000 + 24 * 3600_000);
  return jst.toISOString().slice(0, 10);
}

/** 受付開始＝開始の20分前 */
function receptionStart(start: string): string {
  const [h, m] = start.split(':').map(Number);
  const t = h * 60 + m - 20;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const BADGE_COLORS = { saturday: '#2563eb', sunday: '#dc2626', holiday: '#dc2626', weekday: '#4b5563' };

function readEvents(file: string): ScheduleEvent[] {
  const data = JSON.parse(readFileSync(join(root, 'src/shared', file), 'utf8'));
  return Array.isArray(data) ? data : data.events;
}

const date = process.argv[2] || tomorrowJst();
const outDir = resolve(process.argv[3] ?? '.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`日付は YYYY-MM-DD で指定してください: ${date}`);
  process.exit(1);
}

const events = mergeEventLists(readEvents('events.json'), readEvents('events-archive.json'))
  .filter((e) => e.date === date)
  .sort((a, b) => a.start.localeCompare(b.start));
if (events.length === 0) {
  console.error(`${date} の鬼火CSは見つかりませんでした`);
  process.exit(1);
}

const font = (w: number) =>
  'data:font/woff2;base64,' +
  readFileSync(require.resolve(`@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-${w}-normal.woff2`)).toString('base64');
const background = 'data:image/png;base64,' + readFileSync(join(here, 'background.png')).toString('base64');

mkdirSync(outDir, { recursive: true });
// 入れてある Chromium の版が合わないときは CHROMIUM_PATH で実行ファイルを指定する
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 } });
  await page.setContent('<canvas id="c" width="1200" height="675"></canvas><style>body{margin:0}</style>');
  for (const e of events) {
    const [, mo, d] = date.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const spec = {
      background,
      fonts: { bold: font(700), black: font(900) },
      date: `${mo}/${d}`,
      weekday,
      badgeColor: BADGE_COLORS[dayKind(date)],
      time: `${receptionStart(e.start)}~`,
      name: `鬼火CS in ${e.venue}`,
    };
    const png: string = await page.evaluate(draw, spec);
    const file = join(outDir, `鬼火CS_${date}_${e.venue}.png`);
    writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    console.log(file);
  }
} finally {
  await browser.close();
}

/** ブラウザ内で描く。見本の文字列で大きさ・横幅の倍率を決め、同じ大きさで新しい文字列を描く */
async function draw(s: {
  background: string; fonts: { bold: string; black: string };
  date: string; weekday: string; badgeColor: string; time: string; name: string;
}): Promise<string> {
  const bold = new FontFace('CoverBold', `url(${s.fonts.bold})`, { weight: '700' });
  const black = new FontFace('CoverBlack', `url(${s.fonts.black})`, { weight: '900' });
  await Promise.all([bold.load(), black.load()]);
  document.fonts.add(bold);
  document.fonts.add(black);
  const img = new Image();
  img.src = s.background;
  await img.decode();

  const c = document.getElementById('c') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 1200, 675);

  /** 見本の文字列のインクの箱（左・上・右・下）に合う font-size と横倍率 */
  function calibrate(family: string, sample: string, box: [number, number, number, number]) {
    ctx.font = `100px ${family}`;
    const m = ctx.measureText(sample);
    const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const size = (100 * (box[3] - box[1])) / inkH;
    ctx.font = `${size}px ${family}`;
    const m2 = ctx.measureText(sample);
    const scale = (box[2] - box[0]) / (m2.actualBoundingBoxLeft + m2.actualBoundingBoxRight);
    return { family, size, scale, baseline: box[3] - (m2.actualBoundingBoxDescent) };
  }
  type Style = ReturnType<typeof calibrate>;

  /** 左端 x に描き、右端の x を返す。maxWidth を超えるなら横に縮める */
  function text(st: Style, str: string, x: number, maxWidth = Infinity): number {
    ctx.font = `${st.size}px ${st.family}`;
    const m = ctx.measureText(str);
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const scale = Math.min(st.scale, maxWidth / w);
    ctx.save();
    ctx.translate(x, st.baseline);
    ctx.scale(scale, 1);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    ctx.fillText(str, m.actualBoundingBoxLeft, 0);
    ctx.restore();
    return x + w * scale;
  }

  const dateStyle = calibrate('CoverBlack', '11/28', [53, 433, 278, 541]);
  const labelStyle = calibrate('CoverBold', '受付', [382, 515, 432, 539]);
  const timeStyle = calibrate('CoverBlack', '15:00~', [444, 483, 632, 540]);
  const nameStyle = calibrate('CoverBold', '鬼火CS in 竜星のPAO秋葉原ロケット無線店', [52, 580, 1071, 628]);

  // 見本の間隔: 日付→バッジ 21px、バッジ幅 59、バッジ→受付 24px、受付→時刻 12px
  const dateRight = text(dateStyle, s.date, 53);
  const bx = dateRight + 21;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = s.badgeColor;
  ctx.beginPath();
  ctx.roundRect(bx, 480, 59, 60, 4);
  ctx.fill();
  ctx.restore();
  ctx.font = `34px CoverBold`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.weekday, bx + 29.5, 511);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  const labelRight = text(labelStyle, '受付', bx + 59 + 24);
  text(timeStyle, s.time, labelRight + 12);
  text(nameStyle, s.name, 52, 1150 - 52);

  return c.toDataURL('image/png');
}
