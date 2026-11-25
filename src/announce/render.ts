/**
 * 大会ごとの告知画像（1200×675 PNG）を書き出す（Node 専用）。
 * 実行: npm run announce -- <YYYY-MM> [--date YYYY-MM-DD] [--venue 開催地の一部] [--reception HH:MM]
 * 出力: src/announce/out/<YYYY-MM>/<YYYY-MM-DD>_<HHMM>_<開催地>.png
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import { mergeEventLists, type ScheduleEvent } from '../shared/events.ts';
import { announceText, eventsInMonth } from './announce.ts';
import { announceSvg, FONT_JP } from './template.ts';

const USAGE = '使い方: npm run announce -- <YYYY-MM> [--date YYYY-MM-DD] [--venue 開催地の一部] [--reception HH:MM]';
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: { date: { type: 'string' }, venue: { type: 'string' }, reception: { type: 'string' } },
    });
  } catch {
    console.error(USAGE);
    return 1;
  }
  const { values, positionals } = parsed;
  const month = positionals[0];
  if (
    positionals.length !== 1 ||
    !/^\d{4}-\d{2}$/.test(month) ||
    (values.date !== undefined && !(/^\d{4}-\d{2}-\d{2}$/.test(values.date) && values.date.startsWith(`${month}-`))) ||
    (values.reception !== undefined && !/^\d{2}:\d{2}$/.test(values.reception))
  ) {
    console.error(USAGE);
    return 1;
  }

  const events = mergeEventLists(
    await readEvents('../shared/events-archive.json'),
    await readEvents('../shared/events.json'),
  );
  // --date を付けたときは開催済みの大会も作れる
  const today = values.date ?? new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
  const targets = eventsInMonth(events, month, today).filter(
    (e) => (values.date === undefined || e.date === values.date) && (values.venue === undefined || e.venue.includes(values.venue)),
  );
  if (targets.length === 0) {
    console.log('作る画像がありません');
    return 0;
  }

  const fontDir = path('./assets/fonts/');
  const fontFiles = (await readdir(fontDir)).filter((f) => f.endsWith('.ttf')).map((f) => fontDir + f);
  const background = `data:image/jpeg;base64,${(await readFile(path('./assets/key-visual.jpg'))).toString('base64')}`;
  const outDir = path(`./out/${month}/`);
  await mkdir(outDir, { recursive: true });

  for (const e of targets) {
    const text = announceText(e, values.reception);
    const svg = announceSvg(text, background);
    const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: FONT_JP } }).render().asPng();
    const file = outDir + text.fileName;
    await writeFile(file, png);
    console.log(file);
  }
  return 0;
}

async function readEvents(rel: string): Promise<ScheduleEvent[]> {
  return (JSON.parse(await readFile(path(rel), 'utf8')) as { events: ScheduleEvent[] }).events;
}

process.exitCode = await main();
