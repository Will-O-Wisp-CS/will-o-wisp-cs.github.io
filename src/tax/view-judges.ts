import { el } from '../shared/dom';
import type { App } from './app';
import { todayJst } from './format';
import { judgeMonths, setAssignment, venueColorOf, type JudgeRow } from './judges';
import { button, input, table } from './ui';

/** 過去の開催を表示するか（タブを移っても保つ。保存はしない） */
let showPast = false;

const NAMES_ID = 'judge-names';

/** ジャッジ: 開催ごとの HJ・FJ の割り当て */
export function render(root: HTMLElement, app: App): void {
  const settings = app.settings.data;
  const months = judgeMonths(app.schedule, app.judges.data, app.ledger.data.events, todayJst(new Date()), showPast);

  const names = document.createElement('datalist');
  names.id = NAMES_ID;
  for (const name of settings.judgeNames ?? []) {
    const opt = document.createElement('option');
    opt.value = name;
    names.append(opt);
  }

  const head = el('section', '', 'card');
  head.append(el('h2', 'ジャッジ', 'card-title'));
  head.append(el('p', '候補は設定の「ジャッジの名前」から出ます。候補にない名前もそのまま入力できます。', 'note'));
  const toggle = button(showPast ? '過去の開催を隠す' : '過去の開催を表示', () => {
    showPast = !showPast;
    root.replaceChildren();
    render(root, app);
  }, 'tax-secondary');
  head.append(toggle, names);
  root.append(head);

  if (months.length === 0) {
    const none = el('section', '', 'card');
    none.append(el('p', '表示する開催がありません', 'note'));
    root.append(none);
    return;
  }

  for (const month of months) {
    const card = el('section', '', 'card');
    card.append(el('h2', month.label, 'card-title'));
    const rows = month.rows.map((row) => rowCells(row, app));
    const t = table(['開催日', '受付', '会場名', 'HJ', 'FJ'], rows);
    t.classList.add('tax-judges');
    // 中止の行はクラスで薄くする（table() は中身だけ作るので後から足す）
    t.querySelectorAll('tr').forEach((tr, i) => {
      if (i > 0 && month.rows[i - 1].cancelled) tr.classList.add('tax-judge-cancelled');
    });
    const scroll = el('div', '', 'tax-judges-scroll');
    scroll.append(t);
    card.append(scroll);
    root.append(card);
  }
}

function nameInput(value: string, label: string): HTMLInputElement {
  const i = input('text', value, { list: NAMES_ID, 'aria-label': label });
  i.classList.remove('tax-text');
  return i;
}

function rowCells(row: JudgeRow, app: App): (string | Node)[] {
  const venue = el('span', row.venue, `tax-venue tax-venue-${venueColorOf(app.settings.data, row.venue)}`);
  const venueCell = el('span', '');
  venueCell.append(venue);
  if (row.cancelled) venueCell.append(el('span', '中止', 'tax-judge-cancelled-badge'));

  const hj = nameInput(row.assignment.hj, `${row.date} ${row.venue} の HJ`);
  const fjBox = el('div', '', 'tax-judge-fj');
  const fjInputs: HTMLInputElement[] = [];
  const addFj = (value: string) => {
    const i = nameInput(value, `${row.date} ${row.venue} の FJ`);
    i.addEventListener('change', save);
    fjInputs.push(i);
    fjBox.insertBefore(i, plus);
  };
  // 「＋」は空の枠を足すだけで保存しない（空の枠は保存のときに詰める）
  const plus = button('＋', () => addFj(''), 'tax-secondary tax-judge-add');
  plus.setAttribute('aria-label', 'FJ を追加');
  fjBox.append(plus);
  for (const name of row.assignment.fj.length > 0 ? row.assignment.fj : ['']) addFj(name);

  function save(): void {
    void app.saveJudges((j) => setAssignment(j, row.id, { hj: hj.value, fj: fjInputs.map((i) => i.value) }));
  }
  hj.addEventListener('change', save);

  // 曜日は開催日の列にまとめ、土日祝はマーカーを付ける
  const date = el('span', `${row.date}(`);
  date.append(el('span', row.weekday, `tax-judge-day day-${row.dayKind}`), ')');
  return [date, row.reception, venueCell, hj, fjBox];
}
