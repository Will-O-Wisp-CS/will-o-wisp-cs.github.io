# 鬼火CS 帳簿（青色申告）ページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本人の Google ドライブに帳簿と領収書を保存し、鬼火CSの未記録の開催をリマインドしながら、青色申告決算書に入力する数字を出す `/tax/` ページを追加する。

**Architecture:** 計算・変換は純粋関数（`ledger.ts` / `journal.ts` / `reminder.ts` / `report.ts` / `csv.ts` / `receipt.ts` / `store.ts` の純粋部分）に分けて vitest でテストする。Google 連携は `drive.ts`（REST を `fetch` で呼ぶ薄い層）、帳簿の読み書き・バックアップは `store.ts`。DOM は `main.ts`（ログインとタブ）と画面ごとの `view-*.ts` に分ける。

**Tech Stack:** Vite 8（rolldown）、TypeScript（strict）、vitest。Google Identity Services（`https://accounts.google.com/gsi/client` を `<script>` で読む）と Drive API v3 REST。npm 依存は増やさない。

**Spec:** `docs/superpowers/specs/2026-10-07-tax-ledger-design.md`

## Global Constraints

- 金額はすべて整数（円）。浮動小数で計算しない
- 1取引＝1仕訳（借方1つ・貸方1つ）。会計期間は暦年
- 入力は全角数字を受け付ける（`normalize('NFKC')`）。金額は `,` `¥` `円` も許す
- 勘定科目は spec の表のとおり固定。会場費＝地代家賃、賞品代＝広告宣伝費
- OAuth スコープは `https://www.googleapis.com/auth/drive.file` のみ。トークンはメモリだけに置く（localStorage 等に保存しない）
- ログイン前は帳簿のデータを一切表示しない
- ドライブのフォルダ名 `鬼火CS帳簿`、ファイル名 `settings.json` / `ledger-YYYY.json` / `backup/` / `receipts/YYYY/`。バックアップは年ごとに最新30件
- 領収書のファイル名は `YYYY-MM-DD_金額_取引先.拡張子`。画像は長辺 2000px の JPEG に縮小、PDF はそのまま
- CSV は BOM 付き UTF-8・CRLF
- `/tax/` はメニュー（`SITE_PAGES`）とトップのカードに載せない。`<meta name="robots" content="noindex">`
- UI 文言・テスト名・コメントは日本語。色は `src/shared/style.css` の CSS 変数
- 機能フォルダ同士は import しない。テストは対象ファイルの隣に `*.test.ts`
- コミットメッセージは `feat:` などの接頭辞付き英語。末尾に
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` と `Claude-Session: https://claude.ai/code/session_01ULv9XQGryXnjEZZGC4NDWo`

## Review Focus

1. **入力中の帳簿と違う年の日付**（例: 2026年の帳簿を開いて 2025-12-31 の経費を入力）→ 保存せず「2025年の帳簿に切り替えてから入力してください」と出す。Task 2 でテストする
2. **日程が変わった開催**（`events.json` で同じ URL の開催日・開始時刻・開催地が変わった）→ 帳簿の開催を新しい値で上書きし、中止フラグは保つ。Task 3 でテストする
3. **取引先が空、またはファイル名に使えない文字（`/ \ : * ? " < > |`）を含む** → 空なら `取引先なし`、使えない文字は `_` に置き換え。Task 6 でテストする
4. **金額の書き方の揺れ**（`5,500` / `¥5500` / `５５００円`）→ すべて 5500 として受け付ける。0・負数・小数は拒否。Task 2 でテストする
5. **年の途中で帳簿を使い始めた場合の開催**（記帳開始日より前の開催）→ リマインドに出さない。境界は記帳開始日当日の開催は対象。Task 3 でテストする

---

### Task 1: 型と勘定科目

**Files:**
- Create: `src/tax/ledger.ts`
- Test: `src/tax/ledger.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - spec「データ形式」の `AccountId` / `Receipt` / `Transaction` / `LedgerEvent` / `Ledger` / `Settings` 型（spec のコードブロックをそのまま export）
  - `type AccountKind = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'`
  - `ACCOUNTS: { id: AccountId; label: string; kind: AccountKind; hint?: string }[]`（spec の表の順）
  - `EXPENSE_ACCOUNTS: AccountId[]`（`rent, advertising, travel, entertainment, supplies, communication, fees, misc`）
  - `PAYMENT_ACCOUNTS: AccountId[]`（`cash, bank, ownerLoan`。表示名は 現金 / 普通預金 / 個人のお金）
  - `accountLabel(id: AccountId): string`
  - `isDebitNormal(id: AccountId): boolean`（資産・経費で true）
  - `DEFAULT_SETTINGS(today: string): Settings`（`startDate: today, defaultFee: 0, expenseOrder: EXPENSE_ACCOUNTS`）

- [ ] **Step 1: テストを書く**
  - `ACCOUNTS の表示名が決算書の科目名と一致する`: `accountLabel('rent') === '地代家賃'`、`accountLabel('ownerLoan') === '事業主借'`、`accountLabel('advertising') === '広告宣伝費'`
  - `経費科目に用途の例がある`: `rent` の hint に `会場費`、`advertising` の hint に `賞品代` を含む
  - `借方が増える科目の判定`: `cash`・`ownerDraw`・`rent` が true、`ownerLoan`・`capital`・`sales` が false
- [ ] **Step 2: `npx vitest run src/tax/ledger.test.ts` で失敗を確認**
- [ ] **Step 3: 実装**
- [ ] **Step 4: テストが通ることを確認**
- [ ] **Step 5: コミット** `feat: add tax ledger types and accounts`

### Task 2: 取引の入力 → 仕訳

**Files:**
- Create: `src/tax/journal.ts`
- Test: `src/tax/journal.test.ts`

**Interfaces:**
- Consumes: Task 1 の型、`ParseResult`（`src/shared/parse.ts`）
- Produces:
  - `parseAmount(raw: string, label: string): ParseResult` — NFKC 後に `,` `¥` `￥` `円` と空白を除き、1以上の整数だけ ok
  - `defaultSaleAmount(participants: string, fee: string): string` — 両方が整数なら積の文字列、そうでなければ `''`
  - `type TxDraft = Omit<Transaction, 'id' | 'receipts' | 'updatedAt'>`
  - `type TxResult = { ok: true; tx: TxDraft } | { ok: false; errors: Record<string, string> }`（キーは入力欄名）
  - `parseSale(input: { eventId: string; date: string; participants: string; fee: string; amount: string }, year: number): TxResult` — 借方 `cash` / 貸方 `sales`
  - `parseExpense(input: { date: string; amount: string; account: AccountId | ''; payment: AccountId | ''; counterparty: string; memo: string; eventId: string }, year: number): TxResult` — 借方 account / 貸方 payment。`eventId` が空なら付けない
  - `parseTransfer(input: { date: string; amount: string; from: AccountId | ''; to: AccountId | ''; memo: string }, year: number): TxResult` — 借方 to / 貸方 from。from は `cash|bank|ownerLoan`、to は `cash|bank|ownerDraw`、同じなら拒否
  - 日付は `YYYY-MM-DD`。`year` と違う年なら `errors.date = '{年}年の帳簿に切り替えてから入力してください'`

- [ ] **Step 1: テストを書く**
  - `金額の書き方の揺れを受け付ける`: `'5,500'` `'¥5500'` `'５５００円'` → 5500
  - `0・負数・小数・空は拒否`: `'0'` `'-100'` `'1.5'` `''` → ok:false
  - `売上は 現金/売上高`: `{eventId:'u', date:'2026-10-04', participants:'20', fee:'1000', amount:'20000'}` → `debit:'cash', credit:'sales', amount:20000, participants:20, fee:1000, eventId:'u'`
  - `売上金額の初期値は人数×参加費`: `defaultSaleAmount('２０','1000') === '20000'`、`defaultSaleAmount('','1000') === ''`
  - `経費は 経費科目/支払方法`: 個人のお金で払った会場費 → `debit:'rent', credit:'ownerLoan'`
  - `経費の科目・支払方法が未選択なら拒否`: `errors.account` と `errors.payment` が両方入る
  - `振替は 移動先/移動元`: 現金→事業主貸 で `debit:'ownerDraw', credit:'cash'`。from と to が同じなら拒否
  - `帳簿と違う年の日付は拒否`: year 2026 で `'2025-12-31'` → `errors.date === '2025年の帳簿に切り替えてから入力してください'`
- [ ] **Step 2: 失敗を確認** `npx vitest run src/tax/journal.test.ts`
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認**
- [ ] **Step 5: コミット** `feat: convert tax inputs to journal entries`

### Task 3: 開催の取り込みとリマインド

**Files:**
- Create: `src/tax/reminder.ts`
- Test: `src/tax/reminder.test.ts`

**Interfaces:**
- Consumes: Task 1 の型、`ScheduleEvent`（`src/shared/events.ts`）
- Produces:
  - `mergeEvents(ledger: Ledger, events: ScheduleEvent[]): Ledger` — `events` のうち開催日が `ledger.year` のものを取り込む。ID は `url`。既存は date/venue/start を上書きし `cancelled` を保つ。`events` にない既存の開催は残す。結果は date・start 順。入力は変更しない
  - `type EventStatus = 'upcoming' | 'pending' | 'recorded' | 'cancelled'`
  - `eventStatus(event: LedgerEvent, transactions: Transaction[], now: Date): EventStatus` — 判定順: cancelled → 売上（`kind==='sale' && eventId===event.id`）があれば recorded → JST の `date + start` が `now` 以前なら pending → upcoming
  - `pendingEvents(ledger: Ledger, startDate: string, now: Date): LedgerEvent[]` — status が pending で `date >= startDate` のもの
  - `eventBalance(event: LedgerEvent, transactions: Transaction[]): { sales: number; expenses: number }` — その開催にひも付いた売上と経費の合計

- [ ] **Step 1: テストを書く**
  - `開催を取り込み、同じ URL は重複しない`: 2回 merge しても件数が同じ
  - `events.json から消えた過去の開催は残る`
  - `日程が変わった開催は上書きし、中止は保つ`: cancelled:true の開催の date が変わっても cancelled のまま
  - `別の年の開催は取り込まない`
  - `開始時刻の前後で upcoming と pending が切り替わる`: 開催 `2026-10-04 17:10` に対し `now = 2026-10-04T08:09:00Z`（JST 17:09）は upcoming、`08:10:00Z` は pending
  - `売上があれば recorded、中止なら cancelled`（中止が優先）
  - `記帳開始日より前の開催はリマインドしない`: startDate `2026-10-04` で 10/03 の開催は除外、10/04 は含む
  - `開催ごとの収支`: 売上 20000、ひも付けた会場費 5000 → `{sales:20000, expenses:5000}`
- [ ] **Step 2: 失敗を確認**
- [ ] **Step 3: 実装**（JST は `now.getTime() + 9時間` の ISO 文字列から `YYYY-MM-DD` と `HH:MM` を取り、文字列で比較する）
- [ ] **Step 4: 通ることを確認**
- [ ] **Step 5: コミット** `feat: track ledger events and pending reminders`

### Task 4: 決算の集計

**Files:**
- Create: `src/tax/report.ts`
- Test: `src/tax/report.test.ts`

**Interfaces:**
- Consumes: Task 1 の型
- Produces:
  - `profitLoss(ledger: Ledger): { monthlySales: number[]; sales: number; expenses: { account: AccountId; amount: number }[]; expenseTotal: number; income: number }` — `monthlySales` は12要素。`expenses` は `EXPENSE_ACCOUNTS` の順で全科目（0円も含む）。`income = sales - expenseTotal`
  - `type BalanceRow = { cash: number; bank: number; ownerDraw: number; ownerLoan: number; capital: number }`
  - `balanceSheet(ledger: Ledger): { opening: BalanceRow; closing: BalanceRow; income: number }` — opening は `{cash, bank, ownerDraw:0, ownerLoan:0, capital: cash+bank}`。closing の capital は opening と同じ。資産合計 = 負債・資本合計 + income が常に成り立つ
  - `nextOpening(ledger: Ledger): { cash: number; bank: number }` — 期末の現金・普通預金
  - `type LedgerLine = { date: string; counter: AccountId; summary: string; debit: number; credit: number; balance: number }`
  - `generalLedger(ledger: Ledger, account: AccountId): { opening: number; lines: LedgerLine[] }` — 日付順（同日は入力順）。残高は `isDebitNormal` で向きを決める
  - `summaryOf(tx: Transaction, events: LedgerEvent[]): string` — 売上は `鬼火CS in {開催地} {人数}人`、それ以外は `{取引先} {メモ}` を trim

- [ ] **Step 1: テストを書く**（共通の帳簿: 期首 現金10000、10/4 売上20000、10/4 会場費5000 を現金、10/5 賞品3000 を個人のお金、12/31 現金→事業主貸 15000）
  - `損益計算書`: monthlySales[9] = 20000、地代家賃 5000、広告宣伝費 3000、income 12000
  - `貸借対照表の期末`: cash 10000、ownerDraw 15000、ownerLoan 3000、capital 10000
  - `貸借が一致する`: cash+bank+ownerDraw === ownerLoan+capital+income
  - `翌年の期首`: `{cash:10000, bank:0}`
  - `総勘定元帳の残高`: 現金は 10000 → 30000 → 25000 → 10000、事業主借は 0 → 3000
  - `摘要`: 売上は `鬼火CS in 晴れる屋3 20人`、取引先だけの経費は末尾に空白が残らない
- [ ] **Step 2: 失敗を確認**
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認**
- [ ] **Step 5: コミット** `feat: aggregate profit-loss and balance sheet`

### Task 5: 仕訳帳・総勘定元帳の CSV

**Files:**
- Create: `src/shared/csv.ts`（`csvCell(value: string): string`、`toCsv(rows: string[][]): string` — BOM 付き・各行 CRLF）
- Modify: `src/schedule/csv.ts`（自前の `csvCell` と結合処理を `../shared/csv.ts` に置き換える。Node 直実行のため import は `.ts` 付き）
- Create: `src/tax/csv.ts`
- Test: `src/shared/csv.test.ts`, `src/tax/csv.test.ts`

**Interfaces:**
- Consumes: Task 4 の `generalLedger` / `summaryOf`、Task 1 の `accountLabel`
- Produces:
  - `journalCsv(ledger: Ledger): string` — 列 `日付,借方科目,貸方科目,金額,摘要`、日付順
  - `generalLedgerCsv(ledger: Ledger): string` — 取引がある科目ごとに、科目名の行、`日付,相手科目,摘要,借方金額,貸方金額,残高` の見出し、期首残高の行（日付 `{year}-01-01`、摘要 `前期繰越`）、各行、空行

- [ ] **Step 1: テストを書く**
  - shared: `カンマ・改行・ダブルクォートを含むセルを囲む`、`BOM と CRLF が付く`
  - tax: Task 4 と同じ帳簿で `journalCsv` の2行目が `2026-10-04,現金,売上高,20000,鬼火CS in 晴れる屋3 20人`、`generalLedgerCsv` に `現金` の見出しと `前期繰越` の行（残高 10000）がある
- [ ] **Step 2: 失敗を確認**。既存の `src/schedule/csv.test.ts` は変更前に通ることも確認
- [ ] **Step 3: 実装**
- [ ] **Step 4: `npm test` 全体が通ることを確認**（schedule の CSV テストも含めて）。`node --input-type=module -e "await import('./src/schedule/csv.ts')"` が import エラーなく終わること（Node 直実行の `.ts` import の確認）
- [ ] **Step 5: コミット** `feat: export journal and general ledger as CSV`

### Task 6: 領収書のファイル名と画像縮小

**Files:**
- Create: `src/tax/receipt.ts`
- Test: `src/tax/receipt.test.ts`

**Interfaces:**
- Consumes: Task 1 の `Transaction`
- Produces:
  - `receiptFileName(tx: Pick<Transaction, 'date' | 'amount' | 'counterparty'>, ext: string, index: number): string` — `2026-10-04_5500_晴れる屋.pdf`。2枚目以降は `..._晴れる屋_2.jpg`。取引先が空なら `取引先なし`。`/ \ : * ? " < > |` は `_`
  - `extensionOf(file: { name: string; type: string }): string` — 画像は縮小後なので `jpg`、PDF は `pdf`
  - `fitSize(width: number, height: number, max: number): { width: number; height: number }` — 長辺が max 以下ならそのまま、超えたら比を保って縮小（整数に丸める）
  - `resizeImage(file: File, max = 2000): Promise<Blob>` — `createImageBitmap` と canvas で JPEG（品質 0.85）にする。テストしない

- [ ] **Step 1: テストを書く**
  - `日付_金額_取引先 のファイル名`、`2枚目以降は連番`、`取引先が空なら取引先なし`、`ファイル名に使えない文字は _ に置き換える`（`A/B:C` → `A_B_C`）
  - `fitSize`: `(4000, 3000, 2000)` → `{2000, 1500}`、`(1000, 800, 2000)` → そのまま、`(3000, 4001, 2000)` → `{1500, 2000}`
- [ ] **Step 2: 失敗を確認**
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認**
- [ ] **Step 5: コミット** `feat: name and resize receipt files`

### Task 7: Google ドライブ連携と帳簿の保存

**Files:**
- Create: `src/tax/config.ts`（`export const GOOGLE_CLIENT_ID = ''` — Task 10 で本人の値を入れる）
- Create: `src/tax/drive.ts`
- Create: `src/tax/store.ts`
- Test: `src/tax/store.test.ts`（純粋関数のみ）

**Interfaces:**
- Consumes: Task 1 の型と `DEFAULT_SETTINGS`、Task 4 の `nextOpening`、Task 6 の `receiptFileName`
- Produces（`drive.ts`）:
  - `signIn(clientId: string): Promise<void>` — GIS の `initTokenClient` で `drive.file` のトークンを取る。`expires_in` から期限を覚える
  - `signOut(): void` — `google.accounts.oauth2.revoke` してメモリのトークンを消す
  - `isSignedIn(): boolean`
  - `type DriveFile = { id: string; name: string; version: string }`
  - `findFile(parentId: string | null, name: string, folder?: boolean): Promise<DriveFile | null>`（`parentId` null はマイドライブ直下）
  - `ensureFolder(parentId: string | null, name: string): Promise<string>`
  - `readJson<T>(fileId: string): Promise<T>`、`createJson(parentId: string, name: string, data: unknown): Promise<DriveFile>`、`updateJson(fileId: string, data: unknown): Promise<DriveFile>`
  - `getVersion(fileId: string): Promise<string>`
  - `uploadFile(parentId: string, name: string, blob: Blob): Promise<Receipt>`、`renameFile(fileId: string, name: string): Promise<void>`、`trashFile(fileId: string): Promise<void>`、`listFiles(parentId: string): Promise<DriveFile[]>`
  - 各 API 呼び出しの前に、期限まで60秒を切っていたら `requestAccessToken({ prompt: '' })` で取り直す。HTTP エラーは `DriveError(status, message)` を投げる
- Produces（`store.ts`）:
  - `class ConflictError extends Error`
  - `type Loaded<T> = { data: T; fileId: string; version: string }`
  - `loadSettings(today: string): Promise<Loaded<Settings>>` — なければ `DEFAULT_SETTINGS` で作る
  - `saveSettings(s: Loaded<Settings>): Promise<Loaded<Settings>>`
  - `loadLedger(year: number): Promise<Loaded<Ledger> | { needsOpening: true }>` — なければ前年の帳簿から `nextOpening` で作る。前年もなければ needsOpening
  - `createLedger(year: number, opening: { cash: number; bank: number }): Promise<Loaded<Ledger>>`
  - `saveLedger(l: Loaded<Ledger>): Promise<Loaded<Ledger>>` — 保存前に `getVersion` が `l.version` と違えば `ConflictError`。同じなら現在のファイルを `backup/` に `backupName` でコピーし、`backupsToDelete` の分をゴミ箱へ移してから更新する
  - `attachReceipts(year: number, tx: Transaction, files: File[]): Promise<Receipt[]>` — 画像は `resizeImage`、名前は `receiptFileName`
  - `renameReceipts(tx: Transaction): Promise<void>`（日付・金額・取引先の変更時）、`trashReceipts(tx: Transaction): Promise<void>`
  - 純粋関数: `backupName(year: number, now: Date): string`（`ledger-2026-20261007T120000Z.json`）、`backupsToDelete(names: string[], year: number, keep = 30): string[]`（その年のバックアップのうち古いもの。他の年は対象外）

- [ ] **Step 1: テストを書く**（`store.test.ts`）
  - `backupName は年と UTC 時刻`: `backupName(2026, new Date('2026-10-07T12:00:00.123Z')) === 'ledger-2026-20261007T120000Z.json'`
  - `年ごとに最新30件だけ残す`: 2026年 32件・2025年 5件の名前 → 2026年の古い2件だけを返す
- [ ] **Step 2: 失敗を確認**
- [ ] **Step 3: `drive.ts` と `store.ts` を実装**。GIS の型は `src/tax/gis.d.ts` に使う分だけ宣言する（`@types` は入れない）。JSON の作成・更新は `uploadType=multipart`、`fields=id,name,version`
- [ ] **Step 4: `npm test` と `npx tsc` が通ることを確認**
- [ ] **Step 5: コミット** `feat: store tax ledger in Google Drive`

### Task 8: ページの骨組み・ログイン・ホーム

**Files:**
- Create: `src/tax/index.html`（既存ページと同じ head・`.site-header`・「← 鬼火CS トップ」。`<meta name="robots" content="noindex">` と GIS の `<script src="https://accounts.google.com/gsi/client" async>`）
- Create: `src/tax/main.ts`、`src/tax/view-home.ts`、`src/tax/tax.css`
- Modify: `vite.config.ts`（input に `tax: src('tax/index.html')`）
- Modify: `src/shared/menu.ts`（`PageId` に `'tax'` を足す。`SITE_PAGES` には足さない）

**Interfaces:**
- Consumes: Task 3・4・7
- Produces:
  - `main.ts`: 状態 `{ settings: Loaded<Settings>; ledger: Loaded<Ledger>; year: number }` を持ち、タブ（ホーム / 入力 / 一覧 / 決算 / 設定）を切り替える。各 view は `render(root: HTMLElement, app: App): void` を export し、`App` は `main.ts` が定義する `{ state; save(ledger: Ledger): Promise<void>; openSaleForm(eventId: string): void; switchYear(year: number): Promise<void> }`
  - 保存の失敗表示: `ConflictError` は「他の端末で更新されています。再読み込みしてください」と再読み込みボタン、それ以外は「保存できませんでした」。入力欄は消さない

- [ ] **Step 1: 未ログイン画面**: 「Google でログイン」ボタンと注意書き2つ（紙の領収書は原本を7年保管すること、データの領収書は事務処理規程を用意すること）だけを出す。帳簿の数字は出さない
- [ ] **Step 2: ログイン後の読み込み**: `loadSettings` → `loadLedger(今年)`。`needsOpening` なら期首の現金・普通預金と記帳開始日の入力フォームを出し、`createLedger` する。読み込み後に `mergeEvents(ledger, events.json)` し、変わっていれば保存する
- [ ] **Step 3: ホーム**: 「未記録の開催が N 件あります」と各開催（`10/04(日) 晴れる屋3 17:10`）に「売上を入力」「中止にする」ボタン。0件なら「未記録の開催はありません」。中止にした開催は折りたたみで一覧し、「中止を取り消す」ボタンを付ける。その下に今年の売上・経費・所得（`profitLoss`）
- [ ] **Step 4: `npm run build` が通ることを確認**。`npm run dev` で `/tax/` を開き、未ログイン画面だけが出ることを確認（クライアント ID が空の間はログインボタンを押すと「クライアント ID が未設定です」と出す）
- [ ] **Step 5: コミット** `feat: add tax page shell with Google sign-in and reminders`

### Task 9: 入力・一覧・決算・設定の画面

**Files:**
- Create: `src/tax/view-input.ts`、`src/tax/view-list.ts`、`src/tax/view-report.ts`、`src/tax/view-settings.ts`
- Modify: `src/tax/main.ts`、`src/tax/tax.css`

**Interfaces:**
- Consumes: Task 2・4・5・6・7・8（`App`）
- Produces: なし（画面）

- [ ] **Step 1: 入力**: 売上 / 経費 / 振替の切り替え。売上は開催を選ぶと日付が入り、参加費は `settings.defaultFee`、金額は `defaultSaleAmount` を初期値に（人数・参加費の変更で更新、手で直した後は上書きしない）。保存時に参加費を `defaultFee` に反映。経費は科目を `expenseOrder` 順に hint 付きで出し、開催は任意。`<input type="file" accept="image/*,application/pdf" multiple>`（`capture` なし）を「領収書を追加」の大きなボタンにする。エラーは各入力欄の下に出す
- [ ] **Step 2: 一覧**: 日付の新しい順。日付範囲・金額・取引先（部分一致）・科目で絞り込み。行をタップで編集（日付・金額・取引先が変わったら `renameReceipts`）、削除は確認ダイアログの後 `trashReceipts`。領収書はドライブで開くリンク。下に開催ごとの収支（`eventBalance`）
- [ ] **Step 3: 決算**: 年の選択、損益計算書（月別売上・科目別経費・所得）と貸借対照表（期首・期末）を作成コーナーと同じ並びで表示。「仕訳帳 CSV」「総勘定元帳 CSV」ボタンで `鬼火CS帳簿_仕訳帳_2026.csv` などをダウンロード
- [ ] **Step 4: 設定**: 記帳開始日、参加費の初期値、経費科目の並び（上下ボタン）、期首残高（その年に取引がなければ編集可）、ログアウト
- [ ] **Step 5: `npm test` と `npm run build` が通ることを確認**
- [ ] **Step 6: コミット** `feat: add input, list, report and settings views for tax page`

### Task 10: Google Cloud の設定と実機確認、ドキュメント

**Files:**
- Modify: `src/tax/config.ts`（本人から受け取ったクライアント ID）
- Modify: `.claude/CLAUDE.md`（ページ一覧に `/tax/`、フォルダ構成に `tax/`、ドメインルールに「帳簿」節: データは本人のドライブのみ・`drive.file`・テストユーザー本人のみ・勘定科目の対応・メニューに載せない）

- [ ] **Step 1: 本人に spec「Google Cloud の設定」の手順を案内し、クライアント ID を受け取って `config.ts` に書く**
- [ ] **Step 2: 本人に開発サーバー（`http://localhost:5173/tax/`）か公開後のページで確認してもらう**: ログイン → 期首残高入力 → 売上入力（リマインドが消える）→ 領収書付きの経費入力（ドライブの `鬼火CS帳簿/receipts/2026/` にファイルができる）→ 別の端末で同じデータが見える → 2端末で順に保存すると後の方に衝突メッセージ → 決算と CSV
- [ ] **Step 3: CLAUDE.md を更新し、`npm test` と `npm run build` が通ることを確認**
- [ ] **Step 4: コミット** `chore: configure Google client and document tax page`
