import '../shared/style.css';
import { card, el } from '../shared/dom';
import { buildEntryUrl } from '../shared/entryLink';
import { mountSiteMenu } from '../shared/menu';
import data from '../shared/events.json';
import { formatEventDate, type ScheduleEvent } from '../shared/events';
import { dayKind } from '../shared/calendar';
import { activeMonths, entryStatus, groupByMonth, receptionWindow, type EntryStatus, type MonthGroup } from './schedule';

const schedule = document.querySelector<HTMLDivElement>('#schedule')!;
const updatedAt = document.querySelector<HTMLParagraphElement>('#updated-at')!;
const entryLink = document.querySelector<HTMLAnchorElement>('#entry-link')!;

mountSiteMenu('schedule');

// 開いた日以降の大会だけが表示されるよう、クリック時点の日付を入れる
const updateEntryLink = () => {
  entryLink.href = buildEntryUrl(new Date());
};
updateEntryLink();
entryLink.addEventListener('click', updateEntryLink);

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const COLUMNS = ['開催日', '開催地', 'フォーマット', '参加形式', '定員', '受付'];

updatedAt.textContent = `最終更新 ${formatUpdatedAt(data.updatedAt)}`;

const now = new Date();
const groups = activeMonths(groupByMonth(data.events), now);
schedule.replaceChildren(
  ...(groups.length > 0
    ? groups.map(monthCard)
    : [card('大会スケジュール', el('p', '予定されている大会はありません', 'note'))]),
);

function monthCard(group: MonthGroup): HTMLElement {
  const head = el('tr', '');
  for (const label of COLUMNS) head.append(el('th', label));
  const thead = el('thead', '');
  thead.append(head);
  const tbody = el('tbody', '');
  tbody.append(...group.events.map((e) => eventRow(e, entryStatus(e, now))));
  const table = el('table', '', 'schedule-table');
  table.append(thead, tbody);

  const scroll = el('div', '', 'schedule-scroll');
  scroll.append(table);
  return card(`${group.year}年${group.month}月`, scroll);
}

function eventRow(e: ScheduleEvent, status: EntryStatus): HTMLElement {
  const row = el('tr', '', status.kind === 'finished' ? 'is-finished' : '');
  const date = el('td', '', 'schedule-date');
  date.append(detailLink(formatEventDate(e.date), e.url, `day-${dayKind(e.date)}`));
  const venue = el('td', '', 'schedule-venue');
  venue.append(detailLink(e.venue, e.url, 'schedule-venue-name'), entryBadge(status));
  row.append(
    date,
    venue,
    el('td', e.format, 'schedule-format'),
    el('td', e.entryType, 'schedule-entry'),
    el('td', `${e.capacity}人`, 'schedule-num schedule-capacity'),
    el('td', receptionWindow(e.start), 'schedule-num schedule-reception'),
  );
  return row;
}

/** 大会詳細ページ（dmp-ranking.com）を別タブで開くリンク */
function detailLink(text: string, url: string, className: string): HTMLElement {
  const link = el('a', text, className) as HTMLAnchorElement;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function entryBadge(status: EntryStatus): HTMLElement {
  switch (status.kind) {
    case 'open':
      return el('span', '参加表明受付中', 'entry-badge entry-open');
    case 'upcoming':
      return el('span', `参加表明 ${formatOpensAt(status.opensAt)}〜`, 'entry-badge entry-upcoming');
    case 'finished':
      return el('span', '開催済み', 'entry-badge entry-finished');
  }
}

/** 参加表明の開始日時（JST 20:00 固定）: '9/20(日) 20:00' */
function formatOpensAt(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const iso = jst.toISOString();
  const [, m, day] = iso.slice(0, 10).split('-').map(Number);
  return `${m}/${day}(${WEEKDAYS[jst.getUTCDay()]}) ${iso.slice(11, 16)}`;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
