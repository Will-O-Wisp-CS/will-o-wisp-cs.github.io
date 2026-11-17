/**
 * dmp-ranking.com の店舗管理画面で「公認CSサポート○月開催申請」を出す（Node 専用。Playwright でブラウザを操作）。
 * 入力は GitHub Actions の Run workflow（環境変数 INPUT_*）、ログイン情報は Secrets（DMP_*）。
 * 確認だけ（INPUT_DRY_RUN が false 以外）のときは入力まで行い、〔更新保存〕も〔上記内容で申請する〕も押さない。
 * 実行: npm run apply（.github/workflows/apply.yml）
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Dialog, type Page } from 'playwright';
import { buildFields, type FormValues, type VenueFile } from './fields.ts';
import { parseApplyInput, slotLabel, type Account, type SlotRequest } from './input.ts';
import { findMonthRow, isLoginPage, parseMonthPage, type MonthPage } from './menu.ts';
import { accountSlots, planAccount, type SlotResult } from './plan.ts';
import { summaryMarkdown } from './summary.ts';

const BASE = 'https://www.dmp-ranking.com';
const OUT_DIR = new URL('./out/', import.meta.url);
const ACCOUNTS: Account[] = ['A', 'B', 'C'];

const STATE_DRY = '確認だけ（入力まで。保存していません）';
const STATE_APPLIED = '申請しました';
const STATE_SAVED_ONLY = '保存のみ（未申請）';

type Result = { request: SlotRequest; state: string };

/** ログ・状態表に出す文字列からパスワードとメールアドレスを消す */
function redact(text: string): string {
  const secrets = [process.env.DMP_CONTACT_MAIL, ...ACCOUNTS.map((a) => process.env[`DMP_${a}_PASSWORD`])];
  return secrets.filter((s): s is string => !!s).reduce((t, s) => t.split(s).join('***'), text);
}

const errorMessage = (e: unknown) => redact(e instanceof Error ? e.message : String(e));

/** INPUT_A1_VENUE → a1_venue */
function workflowInputs(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([k, v]) => k.startsWith('INPUT_') && v !== undefined)
      .map(([k, v]) => [k.slice('INPUT_'.length).toLowerCase(), v as string]),
  );
}

/**
 * 確認ダイアログの扱い。普段は「キャンセル」。expectConfirm の間だけ「OK」を押す。
 * alert（入力エラーなど）は閉じて内容を覚えておく。
 */
class Dialogs {
  private allow = false;
  alerts: string[] = [];
  constructor(page: Page) {
    page.on('dialog', (d) => void this.handle(d));
  }
  private async handle(d: Dialog): Promise<void> {
    if (d.type() === 'alert') {
      this.alerts.push(d.message());
      await d.accept();
    } else if (d.type() === 'confirm' && this.allow) {
      await d.accept();
    } else {
      await d.dismiss();
    }
  }
  async expectConfirm<T>(action: () => Promise<T>): Promise<T> {
    this.allow = true;
    this.alerts = [];
    try {
      return await action();
    } finally {
      this.allow = false;
    }
  }
}

async function html(page: Page, path: string): Promise<string> {
  await page.goto(`${BASE}/${path}`, { waitUntil: 'load' });
  return page.content();
}

/** ボタンを押して画面が移るのを待つ */
async function clickAndWait(page: Page, selector: string): Promise<void> {
  await Promise.all([page.waitForEvent('framenavigated', { timeout: 30_000 }), page.click(selector)]);
  await page.waitForLoadState('load');
}

async function login(page: Page, id: string, password: string): Promise<void> {
  await page.goto(`${BASE}/shop/`, { waitUntil: 'load' });
  await page.fill('[name="LoginID"]', id);
  await page.fill('[name="Password"]', password);
  await clickAndWait(page, 'input[value="ログイン"]');
  if (isLoginPage(await html(page, 'shopmenu.asp'))) throw new Error('ログインできませんでした');
}

async function fillDetail(page: Page, values: FormValues): Promise<void> {
  for (const [name, value] of Object.entries(values.texts)) await page.fill(`[name="${name}"]`, value);
  for (const [name, value] of Object.entries(values.selects)) await page.selectOption(`select[name="${name}"]`, value);
  await page.evaluate((hidden) => {
    for (const [name, value] of Object.entries(hidden)) {
      const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (input) input.value = value;
    }
  }, values.hidden);
  const present = await page.$$eval('select[name="JudgeList"] option', (os) => os.map((o) => (o as HTMLOptionElement).value));
  const missing = values.judges.map(String).filter((j) => !present.includes(j));
  if (missing.length > 0) {
    await page.selectOption('select[name="JudgeMoto"]', missing);
    await page.evaluate('JudgeAdd()');
  }
}

async function screenshot(page: Page, name: string): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT_DIR)), fullPage: true, mask: [page.locator('[name="Mail"]')] });
}

type AccountOutcome = { page: MonthPage | null; results: Result[] };

async function runAccount(
  browser: Browser,
  account: Account,
  requests: SlotRequest[],
  ctx: { year: number; month: number; dryRun: boolean; venues: VenueFile; mail: string; today: string },
): Promise<AccountOutcome> {
  const id = process.env[`DMP_${account}_ID`];
  const password = process.env[`DMP_${account}_PASSWORD`];
  if (!id || !password) {
    return { page: null, results: requests.map((request) => ({ request, state: `失敗: Secrets の DMP_${account}_ID / DMP_${account}_PASSWORD がありません` })) };
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  const dialogs = new Dialogs(page);
  let monthPage: MonthPage | null = null;
  try {
    await login(page, id, password);
    const row = findMonthRow(await page.content(), ctx.year, ctx.month, ctx.today);
    // 受付期間外の月も状態の一覧のために読む（割り当ては planAccount が row.open で止める）
    if (row?.eventId) monthPage = parseMonthPage(await html(page, `shopevent.asp?EventID=${row.eventId}`));
    const plan = planAccount(requests, row, monthPage);
    const results: Result[] = plan.skipped.map(({ request, reason }) => ({ request, state: reason }));
    if (plan.apply.length === 0 || !row?.eventId) return { page: monthPage, results };

    // 1件ずつ入力して保存する。1件でも失敗したら、そのアカウントは申請ボタンを押さない
    const saved: SlotRequest[] = [];
    let failed = false;
    for (const { request } of plan.apply) {
      const label = slotLabel(request.slot);
      if (failed) {
        results.push({ request, state: '失敗: 前の枠の保存に失敗したため入力していません' });
        continue;
      }
      try {
        // 空き枠の「○回目開催情報」は Seq が空。保存するとサーバーが Seq を振る
        await html(page, `shopeventsub.asp?EventID=${row.eventId}&Seq=`);
        await fillDetail(page, buildFields(ctx.venues, request.venue, request.date, ctx.mail));
        await screenshot(page, `${request.slot}-filled`);
        if (ctx.dryRun) {
          results.push({ request, state: STATE_DRY });
          continue;
        }
        await dialogs.expectConfirm(() => clickAndWait(page, 'input[value="更新保存"]'));
        const after = parseMonthPage(await html(page, `shopevent.asp?EventID=${row.eventId}`));
        if (!after.registered.some((r) => r.date === request.date)) {
          throw new Error(`保存後の申請画面に ${request.date} がありません${dialogs.alerts.length ? `（${dialogs.alerts.join(' / ')}）` : ''}`);
        }
        saved.push(request);
        console.log(`${label}: 保存しました（${request.date} ${request.venue}）`);
      } catch (e) {
        failed = true;
        results.push({ request, state: `失敗: ${errorMessage(e)}` });
      }
    }
    if (ctx.dryRun) return { page: monthPage, results };
    if (failed) {
      results.push(...saved.map((request) => ({ request, state: STATE_SAVED_ONLY })));
      return { page: monthPage, results };
    }

    await html(page, `shopevent.asp?EventID=${row.eventId}`);
    await dialogs.expectConfirm(() => clickAndWait(page, 'input[value*="上記内容で申請する"]'));
    const status = findMonthRow(await html(page, 'shopmenu.asp'), ctx.year, ctx.month, ctx.today)?.status ?? null;
    await screenshot(page, `${account}-applied`);
    const state = status === '申請確認中です' ? STATE_APPLIED : `${STATE_SAVED_ONLY}? 申請後の状態が「${status ?? '不明'}」です。画面で確かめてください`;
    results.push(...saved.map((request) => ({ request, state })));
    return { page: monthPage, results };
  } catch (e) {
    const state = `失敗: ${errorMessage(e)}`;
    return { page: monthPage, results: requests.map((request) => ({ request, state })) };
  } finally {
    await context.close();
  }
}

/** JST の今日 YYYY-MM-DD（申請受付期間の判定に使う） */
function jstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const venues = JSON.parse(await readFile(new URL('./venues.json', import.meta.url), 'utf8')) as VenueFile;
  const input = parseApplyInput(workflowInputs(), venues.venues.map((v) => v.name));
  if (!input.ok) {
    for (const m of input.messages) console.error(m);
    process.exit(1);
  }
  const { year, month, dryRun, requests } = input.value;
  const mail = process.env.DMP_CONTACT_MAIL ?? '';
  if (requests.length > 0 && !mail) {
    console.error('Secrets の DMP_CONTACT_MAIL がありません');
    process.exit(1);
  }

  // 指定のあるアカウントだけログインする。全部空欄なら状態の一覧のため、ログイン情報のあるアカウントすべて
  const targets = ACCOUNTS.filter((a) =>
    requests.length > 0 ? requests.some((r) => r.account === a) : !!process.env[`DMP_${a}_ID`],
  );
  const browser = await chromium.launch();
  const slots: SlotResult[] = [];
  let ok = true;
  try {
    for (const account of ACCOUNTS) {
      if (!targets.includes(account)) {
        slots.push(...accountSlots(account, null, []).map((s) => ({ ...s, state: requests.length > 0 ? '（今回は見ていません）' : '不明（ログイン情報なし）' })));
        continue;
      }
      const mine = requests.filter((r) => r.account === account);
      const outcome = await runAccount(browser, account, mine, { year, month, dryRun, venues, mail, today: jstToday() });
      if (outcome.results.some((r) => r.state !== STATE_APPLIED && r.state !== STATE_DRY)) ok = false;
      if (requests.length === 0 && !outcome.page) ok = false;
      slots.push(...accountSlots(account, outcome.page, outcome.results));
    }
  } finally {
    await browser.close();
  }

  const md = redact(summaryMarkdown(year, month, dryRun, slots));
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(errorMessage(e));
  process.exit(1);
});
