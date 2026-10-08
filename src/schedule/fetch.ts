/**
 * dmp-ranking.com から当月1日以降の鬼火CSを取得し、events.json を更新する（Node 専用）。
 * あわせて大会の記録（events-archive.json）に足し、記録にない過去の月（2026年1月〜先月）は月ごとに取りに行く。
 * 内容が変わったときだけ書き出す。失敗したらファイルに触れず exit 1。
 * 実行: npm run fetch-schedule（GitHub Actions が毎日 0:00 JST に実行）
 */
import { readFile, writeFile } from 'node:fs/promises';
import { entrySearchUrl } from '../shared/entryLink.ts';
import type { ScheduleEvent } from '../shared/events.ts';
import { mergeArchive, missingMonths, type ArchiveData } from './archive.ts';
import { monthRange } from './csv.ts';
import { parseSchedule } from './parse.ts';
import { sameEvents, searchFromDate } from './schedule.ts';

const OUTPUT = new URL('../shared/events.json', import.meta.url);
const ARCHIVE = new URL('../shared/events-archive.json', import.meta.url);

type ScheduleData = { updatedAt: string; events: ScheduleEvent[] };

async function fetchEvents(url: string): Promise<ScheduleEvent[]> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (onibi-cs-schedule)' } });
  if (!res.ok) throw new Error(`取得に失敗しました: HTTP ${res.status} ${url}`);
  return parseSchedule(new TextDecoder('shift_jis').decode(await res.arrayBuffer()));
}

async function main(): Promise<void> {
  const now = new Date();
  const events = await fetchEvents(entrySearchUrl(searchFromDate(now)));

  // 記録にない過去の月を取る（1か月ずつ。検索は開催日の範囲指定だが、念のため指定月以外は除く）
  const archive = (await readJson<ArchiveData>(ARCHIVE)) ?? { updatedAt: '', months: [], events: [] };
  const months = missingMonths(archive.months, now);
  const past: ScheduleEvent[] = [];
  for (const month of months) {
    const [y, m] = month.split('-').map(Number);
    const { from, to } = monthRange(y, m);
    const found = (await fetchEvents(entrySearchUrl(from, to))).filter((e) => e.date.startsWith(`${month}-`));
    console.log(`${month}: ${found.length}件を記録に足しました`);
    past.push(...found);
  }
  const nextArchive = mergeArchive(archive, [...past, ...events], months);

  const current = await readJson<ScheduleData>(OUTPUT);
  if (current && sameEvents(current.events, events)) {
    console.log(`変更なし（${events.length}件）`);
  } else {
    const data: ScheduleData = { updatedAt: now.toISOString(), events };
    await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`更新しました（${events.length}件）`);
  }

  if (sameEvents(archive.events, nextArchive.events) && archive.months.join() === nextArchive.months.join()) {
    console.log(`記録は変更なし（${nextArchive.events.length}件）`);
  } else {
    await writeFile(ARCHIVE, `${JSON.stringify({ ...nextArchive, updatedAt: now.toISOString() }, null, 2)}\n`);
    console.log(`記録を更新しました（${nextArchive.events.length}件）`);
  }
}

async function readJson<T>(url: URL): Promise<T | null> {
  try {
    return JSON.parse(await readFile(url, 'utf-8')) as T;
  } catch {
    return null;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
