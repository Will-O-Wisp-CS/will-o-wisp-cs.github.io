import '../shared/style.css';
import './tax.css';
import { el } from '../shared/dom';
import type { ScheduleEvent } from '../shared/events';
import data from '../shared/events.json';
import { mountSiteMenu } from '../shared/menu';
import type { App } from './app';
import { GOOGLE_CLIENT_ID } from './config';
import * as drive from './drive';
import { todayJst } from './format';
import { parseAmount } from './journal';
import type { Ledger, Settings } from './ledger';
import { mergeEvents } from './reminder';
import * as store from './store';
import { button, field, input, showErrors } from './ui';
import * as homeView from './view-home';
import * as inputView from './view-input';
import * as listView from './view-list';
import * as reportView from './view-report';
import * as settingsView from './view-settings';

type Tab = 'home' | 'input' | 'list' | 'report' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'input', label: '入力' },
  { id: 'list', label: '一覧' },
  { id: 'report', label: '決算' },
  { id: 'settings', label: '設定' },
];

const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const tabsEl = document.querySelector<HTMLElement>('#tabs')!;
const viewEl = document.querySelector<HTMLDivElement>('#view')!;
const schedule = (data as { events: ScheduleEvent[] }).events;

mountSiteMenu('tax');

let app: App | null = null;
let tab: Tab = 'home';

function showStatus(message: string, kind: 'info' | 'error' = 'info', action?: HTMLButtonElement): void {
  statusEl.replaceChildren(el('span', message));
  if (action) statusEl.append(action);
  statusEl.dataset.kind = kind;
  statusEl.hidden = message === '';
}

function errorMessage(e: unknown): string {
  if (e instanceof store.ConflictError) return e.message;
  if (e instanceof drive.DriveError && e.status === 401) return 'ログインの期限が切れました。ログインし直してください';
  if (e instanceof Error && !(e instanceof drive.DriveError)) return e.message;
  return '保存できませんでした。通信状態を確かめてもう一度お試しください';
}

function showError(e: unknown): void {
  console.error(e);
  const reload = e instanceof store.ConflictError ? button('再読み込み', () => void loadYear(app!.ledger.data.year), 'tax-secondary') : undefined;
  showStatus(errorMessage(e), 'error', reload);
}

// ---------- 未ログイン ----------

function renderSignedOut(): void {
  tabsEl.hidden = true;
  const section = el('section', '', 'card');
  section.append(el('h2', 'ログイン', 'card-title'));
  section.append(el('p', '帳簿と領収書はあなたの Google ドライブの「鬼火CS帳簿」フォルダに保存します。', 'rules-text'));
  const login = button('Google でログイン', () => void signIn(), 'submit-wide');
  section.append(login);
  const notice = el('ul', '', 'tax-notice');
  notice.append(
    el('li', '紙でもらった領収書は、原本を7年間保管してください（ここで撮った画像は確認用の控えです）'),
    el('li', 'データでもらった領収書（PDF・メールなど）を保存するときは、改ざんしないための事務処理規程を用意してください（国税庁のひな形が使えます）'),
  );
  section.append(notice);
  viewEl.replaceChildren(section);
}

async function signIn(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    showStatus('クライアント ID が未設定です（src/tax/config.ts）', 'error');
    return;
  }
  try {
    showStatus('ログインしています…');
    await drive.signIn(GOOGLE_CLIENT_ID);
    await loadYear(Number(todayJst(new Date()).slice(0, 4)));
  } catch (e) {
    showError(e);
  }
}

function signOut(): void {
  drive.signOut();
  store.resetStore();
  app = null;
  showStatus('ログアウトしました');
  renderSignedOut();
}

// ---------- 読み込み ----------

async function loadYear(year: number): Promise<void> {
  showStatus('読み込んでいます…');
  try {
    const settings = await store.loadSettings(todayJst(new Date()));
    const loaded = await store.loadLedger(year);
    if ('needsOpening' in loaded) {
      renderOpening(year, settings);
      showStatus('');
      return;
    }
    await start(settings, loaded);
  } catch (e) {
    showError(e);
  }
}

/** 初めての年: 期首残高と記帳開始日を入れて帳簿を作る */
function renderOpening(year: number, settings: store.Loaded<Settings>): void {
  tabsEl.hidden = true;
  const section = el('section', '', 'card');
  section.append(el('h2', `${year}年の帳簿を作る`, 'card-title'));
  section.append(el('p', `${year}年1月1日時点の事業用のお金を入力してください。わからなければ 0 で構いません。`, 'rules-text'));
  const form = el('form', '', 'tax-form') as HTMLFormElement;
  const cash = input('text', '0', { inputmode: 'numeric' });
  const bank = input('text', '0', { inputmode: 'numeric' });
  const startDate = input('date', settings.data.startDate);
  const fields = {
    cash: field('現金', cash),
    bank: field('普通預金', bank),
    startDate: field('記帳開始日', startDate, 'この日より前の開催はリマインドしません'),
  };
  form.append(...Object.values(fields).map((f) => f.wrap));
  const submit = el('button', '帳簿を作る', 'submit-wide') as HTMLButtonElement;
  form.append(submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const amount = (raw: string, name: string, label: string) => {
      if (raw.normalize('NFKC').trim() === '0') return 0;
      const r = parseAmount(raw, label);
      if (r.ok) return r.value;
      errors[name] = r.message;
      return 0;
    };
    const opening = { cash: amount(cash.value, 'cash', '現金'), bank: amount(bank.value, 'bank', '普通預金') };
    if (!startDate.value) errors.startDate = '記帳開始日を入力してください';
    showErrors(fields, errors);
    if (Object.keys(errors).length > 0) return;
    submit.disabled = true;
    void (async () => {
      try {
        const ledger = await store.createLedger(year, opening);
        const saved = await store.saveSettings({ ...settings, data: { ...settings.data, startDate: startDate.value } });
        await start(saved, ledger);
      } catch (e) {
        submit.disabled = false;
        showError(e);
      }
    })();
  });
  section.append(form);
  viewEl.replaceChildren(section);
}

/** 大会スケジュールの開催を取り込んでから画面を出す */
async function start(settings: store.Loaded<Settings>, ledger: store.Loaded<Ledger>): Promise<void> {
  const merged = mergeEvents(ledger.data, schedule);
  if (JSON.stringify(merged.events) !== JSON.stringify(ledger.data.events)) {
    ledger = await store.saveLedger({ ...ledger, data: merged });
  }
  app = {
    settings,
    ledger,
    inputContext: null,
    save: async (next) => {
      showStatus('保存しています…');
      try {
        app!.ledger = await store.saveLedger({ ...app!.ledger, data: next });
        showStatus('保存しました');
        render();
        return true;
      } catch (e) {
        showError(e);
        return false;
      }
    },
    saveSettings: async (next) => {
      showStatus('保存しています…');
      try {
        app!.settings = await store.saveSettings({ ...app!.settings, data: next });
        showStatus('保存しました');
        render();
        return true;
      } catch (e) {
        showError(e);
        return false;
      }
    },
    openSaleForm: (eventId) => {
      app!.inputContext = { mode: 'sale', eventId };
      setTab('input');
    },
    editTransaction: (id) => {
      app!.inputContext = { mode: 'edit', id };
      setTab('input');
    },
    switchYear: (year) => loadYear(year),
    signOut,
    notify: (message) => showStatus(message),
    fail: showError,
  };
  showStatus('');
  renderTabs();
  render();
}

// ---------- タブ ----------

function renderTabs(): void {
  tabsEl.hidden = false;
  tabsEl.replaceChildren(
    ...TABS.map((t) => {
      const b = button(t.label, () => {
        if (app) app.inputContext = null;
        setTab(t.id);
      });
      if (t.id === tab) b.setAttribute('aria-current', 'page');
      return b;
    }),
  );
}

function setTab(next: Tab): void {
  tab = next;
  renderTabs();
  render();
  window.scrollTo({ top: 0 });
}

function render(): void {
  if (!app) return;
  viewEl.replaceChildren();
  const views = { home: homeView, input: inputView, list: listView, report: reportView, settings: settingsView };
  views[tab].render(viewEl, app);
}

renderSignedOut();
