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
import { createQueue } from './queue';
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
/** 表示中（または読み込み中）の帳簿の年。再読み込みに使う */
let currentYear = Number(todayJst(new Date()).slice(0, 4));
/** 帳簿・設定の保存は1つずつ順に行う（重なると古い内容で上書きしてしまうため） */
const serial = createQueue();
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
  const reload = e instanceof store.ConflictError ? button('再読み込み', () => void loadYear(currentYear), 'tax-secondary') : undefined;
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
  currentYear = year;
  // 読み込み中に古い画面で保存されないよう、画面を消しておく
  app = null;
  tabsEl.hidden = true;
  viewEl.replaceChildren();
  showStatus('読み込んでいます…');
  try {
    const settings = await store.loadSettings(todayJst(new Date()));
    const loaded = await store.loadLedger(year);
    if ('needsOpening' in loaded) {
      renderOpening(year, settings);
      showStatus('');
      return;
    }
    await start(settings, loaded, await store.hasPreviousLedger(year));
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
        // 再試行でも重複しないよう、帳簿は既存を使い、設定は読み直してから保存する
        const ledger = await store.createLedger(year, opening);
        const latest = await store.loadSettings(todayJst(new Date()));
        const saved = await store.saveSettings({ ...latest, data: { ...latest.data, startDate: startDate.value } });
        await start(saved, { ...ledger, openingChanged: false }, false);
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
async function start(settings: store.Loaded<Settings>, loaded: store.LoadedLedger, openingLocked: boolean): Promise<void> {
  let ledger: store.Loaded<Ledger> = loaded;
  const merged = mergeEvents(ledger.data, schedule);
  if (loaded.openingChanged || JSON.stringify(merged.events) !== JSON.stringify(ledger.data.events)) {
    ledger = await store.saveLedger({ ...ledger, data: merged });
  }
  app = {
    settings,
    ledger,
    openingLocked,
    inputContext: null,
    save: (update) => {
      // トークンの取り直しがクリック直後に始まるよう、await より前に呼ぶ
      const fresh = drive.ensureFresh();
      return serial(async () => {
        showStatus('保存しています…');
        try {
          await fresh;
          app!.ledger = await store.saveLedger({ ...app!.ledger, data: update(app!.ledger.data) });
          showStatus('保存しました');
          render();
          return true;
        } catch (e) {
          showError(e);
          return false;
        }
      });
    },
    saveSettings: (update, failureNote) => {
      const fresh = drive.ensureFresh();
      return serial(async () => {
        if (!failureNote) showStatus('保存しています…');
        try {
          await fresh;
          app!.settings = await store.saveSettings({ ...app!.settings, data: update(app!.settings.data) });
          if (!failureNote) showStatus('保存しました');
          render();
          return true;
        } catch (e) {
          if (failureNote) showStatus(failureNote);
          else showError(e);
          return false;
        }
      });
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
  // 失敗しても保存時に探し直すので、エラーは出さない
  store.prefetchFolders(loaded.data.year).catch(() => {});
  showStatus(loaded.openingChanged ? `期首残高を${loaded.data.year - 1}年の期末に合わせました` : '');
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
