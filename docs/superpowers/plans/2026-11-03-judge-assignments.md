# 帳簿「ジャッジ」タブ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 帳簿（`/tax/`）に、取り込み済みの大会へ HJ・FJ を割り当てて Google ドライブに保存する「ジャッジ」タブを足す。

**Architecture:** 表の行づくり・割り当ての更新などは純粋関数（`src/tax/judges.ts`）にしてテストする。保存は `store.ts` に `judges.json` 用の load/save を足し、既存の `saveChecked`（`rev` の比較）を使う。画面は `view-judges.ts`、設定画面に名前と会場の色の欄を足す。

**Tech Stack:** Vite 8 + TypeScript（strict）+ vitest。依存の追加なし。

**Spec:** `docs/superpowers/specs/2026-11-03-judge-assignments-design.md`

## Global Constraints
- UI 文言・テスト名・コメントは日本語。コミットは `feat:` / `fix:` / `chore:` などの接頭辞付き英語
- テストは対象ファイルの隣に `*.test.ts`
- 機能フォルダ同士は import しない（`tax/` から `schedule/` を import しない）
- DOM を触るのは `main.ts`・`view-*.ts`・`ui.ts` だけ
- 帳簿のデータはドライブの「鬼火CS帳簿」フォルダにだけ置く。localStorage に入れない
- 色は CSS 変数（`src/shared/style.css`・`src/tax/tax.css`）で書く
- 各タスクの最後に `npm test` と `npx tsc --noEmit` が通ること

## Review Focus
- **同じ会場名の表記ゆれ**：会場名は取得結果そのまま（`竜星のPAO千葉中央店`、空白なし）。`venueColors` のキーも同じ文字列を使い、加工しない → Task 2 の `venuesOf` のテストで取得結果の表記を使う
- **続けて入力**：HJ を入れてすぐ FJ に移ると保存が2つ重なる。`serial` の順番待ちで、2つ目は1つ目の保存結果（新しい `rev`）の上に積む → Task 4 で `saveJudges` を `serial` に通す。`update` は保存の直前に最新の `app.judges.data` へかける
- **手入力の空白だけ**：`'  '` は空として扱い、HJ・FJ が全部空なら割り当てを消す → Task 2 のテスト
- **年をまたぐ月**：12月に見ると翌年1月の開催も表示される（`schedule` は年で絞らない）。中止の判定は開いている年の帳簿にある開催だけ → Task 2 のテスト
- **他の端末で更新済み**：`ConflictError` のときは帳簿と同じエラー表示（再読み込みボタン）になり、画面は保存前の値に戻る → Task 4 の手動確認

---

### Task 1: 祝日の判定を shared/ に移す

**Files:**
- Move: `src/schedule/calendar.ts` → `src/shared/calendar.ts`
- Move: `src/schedule/calendar.test.ts` → `src/shared/calendar.test.ts`
- Modify: `src/schedule/main.ts:7`（`import { dayKind } from '../shared/calendar';`）
- Modify: `.claude/CLAUDE.md`（フォルダ構成の `schedule/` から `calendar.ts(祝日)` を消し、`shared/` に `calendar.ts(祝日)` を足す）

**Interfaces:**
- Produces: `dayKind(iso: string): 'holiday' | 'sunday' | 'saturday' | 'weekday'`（`src/shared/calendar.ts`、中身は変えない）

- [ ] **Step 1:** `git mv` で2ファイルを移し、`schedule/main.ts` の import を直す。`calendar.ts` の中の import に `.ts` 拡張子の決まりがあるか確認（`fetch.ts`・`export-csv.ts` から import されていなければそのまま）
- [ ] **Step 2:** Run `npm test` と `npx tsc --noEmit` → すべて PASS
- [ ] **Step 3:** CLAUDE.md を直してコミット `chore: move holiday calendar to shared`

### Task 2: 割り当ての純粋関数（judges.ts）

**Files:**
- Modify: `src/tax/ledger.ts`（型と `Settings` の項目）
- Create: `src/tax/judges.ts`
- Test: `src/tax/judges.test.ts`

**Interfaces:**
- Consumes: `ScheduleEvent`（`../shared/events`）、`dayKind`（Task 1）、`LedgerEvent`
- Produces（`ledger.ts`）:
  ```ts
  export type JudgeAssignment = { hj: string; fj: string[] };
  /** ジャッジの割り当て（ドライブの judges.json） */
  export type Judges = { assignments: Record<string, JudgeAssignment>; rev?: number };
  export const VENUE_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;
  export type VenueColor = (typeof VENUE_COLORS)[number];
  // Settings に追加
  judgeNames?: string[];
  venueColors?: Record<string, VenueColor>;
  ```
- Produces（`judges.ts`）:
  ```ts
  export type JudgeRow = {
    id: string;            // 大会詳細ページの URL
    date: string;          // '26/11/03'
    weekday: string;       // '火'
    dayKind: DayKind;
    reception: string;     // 受付開始 'HH:MM'
    venue: string;
    cancelled: boolean;
    assignment: JudgeAssignment; // なければ { hj: '', fj: [] }
  };
  export type JudgeMonth = { label: string; rows: JudgeRow[] }; // label '2026年11月'
  export function receptionTime(start: string): string;
  export function judgeMonths(events: ScheduleEvent[], judges: Judges, ledgerEvents: LedgerEvent[], today: string, showPast: boolean): JudgeMonth[];
  export function setAssignment(judges: Judges, id: string, a: JudgeAssignment): Judges;
  export function venuesOf(events: ScheduleEvent[]): string[];
  export function addJudgeName(names: string[], raw: string): string[];
  export function moveItem<T>(list: T[], from: number, to: number): T[];
  ```

- [ ] **Step 1: 失敗するテストを書く**（`judges.test.ts`）
  - `receptionTime`：`'10:30'`→`'10:10'`、`'17:10'`→`'16:50'`、`'15:00'`→`'14:40'`
  - `judgeMonths`：
    - `today='2026-11-03'`、開催 `2026-10-25` / `2026-11-29 10:30` / `2026-11-03 15:30` / `2026-11-03 10:30` / `2027-01-10` → `showPast=false` で見出しは `['2026年11月', '2027年1月']`（月は0埋めしない）。11月の行は 11/03 10:30 → 11/03 15:30 → 11/29 の順。10月は出ない
    - 同じ入力で `showPast=true` なら `'2026年10月'` から3か月
    - 行の中身：`{ date: '26/11/03', weekday: '火', dayKind: 'weekday', reception: '10:10', venue: '竜星のPAO千葉中央店' }`。`2026-11-03` は文化の日なので `dayKind: 'holiday'` になることも確かめる（祝日優先）
    - `ledgerEvents` に `cancelled: true` の同じ ID があれば `cancelled: true`、`ledgerEvents` にない開催（翌年）は `false`
    - `judges.assignments` にある ID はその割り当て、ない ID は `{ hj: '', fj: [] }`
  - `setAssignment`：
    - `{ hj: ' たか ', fj: ['', ' 3Can', ''] }` → 保存されるのは `{ hj: 'たか', fj: ['3Can'] }`
    - `{ hj: '  ', fj: ['', ' '] }` → その ID が `assignments` から消える。ほかの ID は残る
    - 元の `judges` を書き換えない
  - `venuesOf`：`['フルコンプ千葉店', '晴れる屋3', 'フルコンプ千葉店', '竜星の嵐新宿店']` の会場 → 重複なし・`localeCompare('ja')` 順
  - `addJudgeName`：`(['たか'], ' ペルソナ ')` → `['たか', 'ペルソナ']`、`(['たか'], 'たか')` → `['たか']`、`(['たか'], '  ')` → `['たか']`
  - `moveItem`：`(['a','b','c'], 2, 0)` → `['c','a','b']`、範囲外の `to` は元の配列のコピー
- [ ] **Step 2:** Run `npx vitest run src/tax/judges.test.ts` → FAIL（モジュールがない）
- [ ] **Step 3:** `ledger.ts` に型を足し、`judges.ts` を実装する。今日より前の月を落とすのは `e.date.slice(0, 7) >= today.slice(0, 7)`。曜日は `formatEventDate`（`shared/events`）と同じく `Date.UTC` で求める
- [ ] **Step 4:** Run `npx vitest run src/tax/judges.test.ts` → PASS。`npx tsc --noEmit` → PASS
- [ ] **Step 5:** コミット `feat: add judge assignment helpers for the tax ledger`

### Task 3: judges.json の読み書き（store.ts）

**Files:**
- Modify: `src/tax/store.ts`
- Test: `src/tax/store-drive.test.ts`（既存の `vi.mock('./drive')` と `files()` を使う）

**Interfaces:**
- Consumes: `Judges`（Task 2）
- Produces:
  ```ts
  export async function loadJudges(): Promise<Loaded<Judges>>;
  export async function saveJudges(j: Loaded<Judges>): Promise<Loaded<Judges>>;
  ```

ファイルがないときは `loadSettings` と同じく、読み込みの時点で `{ assignments: {} }` を作る（設計書の「最初の保存で作る」より単純で、作るタイミング以外は同じ）。

- [ ] **Step 1: 失敗するテストを書く**（`describe('ジャッジの割り当て')`）
  - `judges.json` がない → `createJson('root', 'judges.json', { assignments: {} })` が呼ばれ、`version` は `'0'`
  - ある（`rev: 3`）→ その中身と `version: '3'`
  - `saveJudges` でドライブ上の `rev` が違う → `ConflictError`、`updateJson` は呼ばれない
  - 同じ → `updateJson` に `rev: 4` で保存。`copyFile`（バックアップ）は呼ばれない
- [ ] **Step 2:** Run `npx vitest run src/tax/store-drive.test.ts` → FAIL
- [ ] **Step 3:** `JUDGES = 'judges.json'` を足し、`loadJudges` は `loadSettings` と同じ形、`saveJudges` は `saveChecked(j)` だけ
- [ ] **Step 4:** Run `npx vitest run src/tax/store-drive.test.ts` → PASS
- [ ] **Step 5:** コミット `feat: store judge assignments in judges.json on Drive`

### Task 4: ジャッジタブの画面

**Files:**
- Modify: `src/tax/app.ts`、`src/tax/main.ts`
- Create: `src/tax/view-judges.ts`
- Modify: `src/tax/tax.css`

**Interfaces:**
- Consumes: `judgeMonths`・`setAssignment`（Task 2）、`loadJudges`・`saveJudges`（Task 3）
- Produces（`App` に追加）:
  ```ts
  /** 大会の記録と今の大会スケジュールを合わせた一覧 */
  schedule: ScheduleEvent[];
  judges: Loaded<Judges>;
  /** 最新の割り当てに update をかけて保存する。成功・失敗とも再描画し、「保存しました」もスクロールもしない */
  saveJudges(update: (judges: Judges) => Judges): Promise<boolean>;
  ```

- [ ] **Step 1:** `main.ts`：`TABS` の「一覧」と「決算」の間に `{ id: 'judges', label: 'ジャッジ' }`。`start()` で `store.loadJudges()` を帳簿と一緒に読む（`start` の呼び出し元で読み込み中のスピナーが出ている間に）。`saveJudges` は `save` と同じく `drive.ensureFresh()` → `busy(() => serial(...), '保存しています…')`。成功で `app.judges` を更新して `render()`、失敗で `showError(e)` と `render()`（入力欄が保存前の値に戻る）。`views` に `judges: judgesView`
- [ ] **Step 2:** `view-judges.ts` の `render(root, app)`：
  - 「過去の開催を表示」のトグル（モジュール内の変数で持つ。localStorage は使わない）
  - 月ごとに `card` と見出し、横スクロールのラッパーの中に表。列は 開催日 / 曜日 / 受付開始時刻 / 会場名 / HJ / FJ
  - 曜日のセルは `day-${dayKind}` のクラス。会場名は `tax-venue tax-venue-${color ?? 'none'}` の札
  - 中止の行は `tax-judge-cancelled` クラスと「中止」の札
  - HJ は `<input list="judge-names">` 1つ。FJ は割り当ての数だけ（0なら1つ）の入力欄と「＋」ボタン（空の欄を1つ足すだけ）
  - 入力欄の `change` で、その行の欄の値を全部集めて `app.saveJudges((j) => setAssignment(j, row.id, { hj, fj }))`
  - `<datalist id="judge-names">` を1つ、`settings.judgeNames` から作る
  - 大会が1つもなければ「表示する開催がありません」
- [ ] **Step 3:** `tax.css`：会場の8色と `none`（グレー）を CSS 変数で（`--venue-red` など。スプレッドシートの札のように背景色＋読める文字色）。曜日のマーカーは `shared/style.css` の `--saturday-marker` などを使い、`.schedule-date a.day-*` と同じ下半分のマーカーにする
- [ ] **Step 4:** Run `npm test`・`npx tsc --noEmit` → PASS。`npm run dev`（`vite-dev`）で `/tax/` を開き、ログイン前の画面が今までどおり出てコンソールにエラーがないことを確かめる（ログイン後は本人のアカウントが要るので、手動確認は本人にお願いする）
- [ ] **Step 5:** コミット `feat: add judge assignments tab to the tax ledger`

### Task 5: 設定（ジャッジの名前・会場の色）と CLAUDE.md

**Files:**
- Modify: `src/tax/view-settings.ts`
- Modify: `.claude/CLAUDE.md`

**Interfaces:**
- Consumes: `addJudgeName`・`moveItem`・`venuesOf`（Task 2）、`VENUE_COLORS`、`app.schedule`（Task 4）、`app.saveSettings`

- [ ] **Step 1:** 設定画面に「ジャッジの名前」カード：名前ごとに 上へ / 下へ / 削除 のボタン、追加の入力欄とボタン。保存は `app.saveSettings((s) => ({ ...s, judgeNames: ... }))`。旅費交通費のテンプレの欄（`view-settings.ts:69-94`）と同じ作り
- [ ] **Step 2:** 「会場の色」カード：`venuesOf(app.schedule)` の会場ごとに `select`（なし＋8色。表示名は 赤 / オレンジ / 黄 / 緑 / 青緑 / 青 / 紫 / ピンク）と色の見本。`change` で `venueColors` を保存。「なし」は キーを消す
- [ ] **Step 3:** CLAUDE.md の帳簿の節に1〜2行（ジャッジタブ：大会ごとの HJ・FJ を `judges.json` に保存。候補は設定の `judgeNames`、会場の色は `venueColors`）。フォルダ構成の `tax/` に `judges.ts(ジャッジの割り当て)` / `view-judges.ts` を足す
- [ ] **Step 4:** Run `npm test`・`npx tsc --noEmit`・`npm run build` → PASS
- [ ] **Step 5:** コミット `feat: manage judge names and venue colors in tax settings`
