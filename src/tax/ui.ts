import { el } from '../shared/dom';

/** 帳簿ページの画面部品（DOM を作るだけ。計算はしない） */

export function button(text: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = el('button', text, className) as HTMLButtonElement;
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export type Field = { wrap: HTMLElement; error: HTMLElement };

/** ラベル・入力・エラー表示をまとめた入力欄 */
export function field(label: string, control: HTMLElement, hint = ''): Field {
  const wrap = el('div', '', 'field');
  const id = `f-${crypto.randomUUID()}`;
  control.id = id;
  const labelEl = el('label', label);
  labelEl.setAttribute('for', id);
  if (hint) labelEl.append(el('span', hint, 'hint'));
  const error = el('p', '', 'error');
  error.setAttribute('role', 'alert');
  wrap.append(labelEl, control, error);
  return { wrap, error };
}

export function input(type: string, value = '', attrs: Record<string, string> = {}): HTMLInputElement {
  const i = document.createElement('input');
  i.type = type;
  i.value = value;
  i.autocomplete = 'off';
  for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v);
  if (type === 'text' && !attrs.inputmode) i.classList.add('tax-text');
  return i;
}

export function select(options: { value: string; label: string }[], value = ''): HTMLSelectElement {
  const s = document.createElement('select');
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    s.append(opt);
  }
  s.value = value;
  return s;
}

/** errors のキーと fields のキーを対応させてエラーを出す */
export function showErrors(fields: Record<string, Field>, errors: Record<string, string>): void {
  for (const [name, f] of Object.entries(fields)) {
    const message = errors[name] ?? '';
    f.error.textContent = message;
    f.wrap.querySelector('input, select')?.setAttribute('aria-invalid', String(message !== ''));
  }
}

export function table(headers: string[], rows: (string | Node)[][], yenColumns: number[] = []): HTMLTableElement {
  const t = el('table', '', 'tax-table') as HTMLTableElement;
  const head = document.createElement('tr');
  headers.forEach((h, i) => head.append(el('th', h, yenColumns.includes(i) ? 'yen' : '')));
  t.append(head);
  for (const row of rows) {
    const tr = document.createElement('tr');
    row.forEach((cell, i) => {
      const td = el('td', '', yenColumns.includes(i) ? 'yen' : '');
      td.append(cell);
      tr.append(td);
    });
    t.append(tr);
  }
  return t;
}

/** ファイルをダウンロードさせる */
export function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
