# 自動申請: 受付開始時刻の指定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「大会を申請」で枠ごとに受付開始時刻を指定でき、開始時刻・参加表明締切・タイムスケジュール文面をまとめてずらして申請する。

**Architecture:** 時刻のずらし（純粋関数）は `fields.ts`、入力の解釈は `input.ts`。`apply.ts` はログイン前に全枠のずらしを検証し、誤りがあれば何もせず終了する。

**Tech Stack:** TypeScript（strict）, vitest, GitHub Actions `workflow_dispatch`

**Spec:** `docs/superpowers/specs/2026-11-17-apply-reception-time-design.md`

## Global Constraints

- テスト名・コメント・メッセージは日本語。全角入力は `normalize('NFKC')` で受け付ける
- `apply.ts` から import されるファイル内の import は `.ts` 拡張子付き（Node で直接実行するため）
- 参加表明締切＝受付の10分前（既存 `ENTRY_LIMIT_BEFORE_RECEPTION`）
- 入力が1つでも誤りならどの枠も申請しない
- コミットメッセージは `feat:` などの接頭辞付き英語

## Review Focus

- 受付を早める（負の差）: 竜星の嵐で `9:40` → 開始 10:00、文面 `9:40～10:00`（1桁の時は1桁のまま）→ Task 1 のテスト
- 文面内の `10:10～10:30` のように全角波ダッシュで区切られた時刻・`　`（全角スペース）区切りの晴れる屋3の文面も全部ずれる → Task 1 のテスト
- 受付 `0:05` は締切が前日になる → エラー。文面の時刻が 24:00 以降になる（晴れる屋3 で `20:00` → 決勝 23:20～24:50）→ エラー → Task 1 のテスト
- `24:00` / `10:60` / `abc` → エラー → Task 2 のテスト
- 受付開始だけ入って会場・日付が空欄の枠 → エラー → Task 2 のテスト

---

### Task 1: 受付開始時刻で会場の時刻をずらす（fields.ts）

**Files:**
- Modify: `src/apply/fields.ts`
- Test: `src/apply/fields.test.ts`

**Interfaces:**
- Produces:
  - `shiftVenue(venue: Venue, reception: string): { ok: true; venue: Venue } | { ok: false; message: string }` — `reception` は `'HH:MM'`。差＝`reception − venue.reception`（分）。返す venue は `reception` を入力値、`start` と `schedule` 内のすべての `\d{1,2}:\d{2}` を差だけずらしたもの（時は元の桁が1桁なら pad しない、分は2桁）。締切（受付−10分）が 0:00 より前、またはずらした時刻のどれかが 24:00 以上・0:00 未満なら `{ ok: false, message: '受付開始 HH:MM では …日をまたぎます' }` の形
  - `buildFields(file, venueName, date, mail, reception: string | null = null)` — `reception` があれば `shiftVenue` 後の venue で値を作る（失敗なら `Error(message)` を throw）

- [ ] **Step 1: 失敗するテストを書く**（`describe('shiftVenue')` と buildFields の追加ケース）
  - 竜星の嵐 `10:40` → `start: '11:00'`、`schedule` が `'10:40～11:00：大会受付（事前受付・当日枠共に）\n11:10～11:20：開会式\n11:20～13:30：予選スイスドロー5回戦\n13:40～15:10：決勝トーナメント'`
  - 竜星の嵐 `9:40` → `start: '10:00'`、schedule の先頭行 `'9:40～10:00：大会受付（事前受付・当日枠共に）'`
  - 晴れる屋3 `17:30` → schedule の最終行 `'20:50～22:20　決勝トーナメント'`
  - 竜星の嵐 `10:10`（差0）→ venue が元と等しい
  - 晴れる屋3 `20:00` → `ok: false`（決勝が 24:50 まで）
  - 竜星の嵐 `0:05` → `ok: false`（締切が前日）
  - `buildFields(file, '竜星の嵐新宿店', '2026-12-19', 'x', '10:40')` → `selects` に `ReceptionHour '10', ReceptionMinute '40', EventStartHour '11', EventStartMinute '00', EntryLimitHour '10', EntryLimitMinute '30'`、`texts.ScheduleInput` が上の文面
  - `buildFields(..., null)` は既存テストと同じ値（既存テストがそのまま通る）

- [ ] **Step 2: `npx vitest run src/apply/fields.test.ts` で失敗を確認**（`shiftVenue` が未定義）

- [ ] **Step 3: `shiftVenue` を実装し、`buildFields` に `reception` 引数を足す**

- [ ] **Step 4: `npx vitest run src/apply/fields.test.ts` が全部 PASS**

- [ ] **Step 5: Commit** `feat: shift venue times by a custom reception time`

### Task 2: 受付開始の入力（input.ts・apply.yml・apply.ts・文書）

**Files:**
- Modify: `src/apply/input.ts`, `src/apply/input.test.ts`, `.github/workflows/apply.yml`, `src/apply/workflow.test.ts`, `src/apply/apply.ts`, `.claude/CLAUDE.md`, `docs/superpowers/specs/2026-11-17-dmp-apply-design.md`

**Interfaces:**
- Consumes: `shiftVenue`, `buildFields(..., reception)`（Task 1）
- Produces:
  - `parseTime(text: string): { ok: true; time: string } | { ok: false; message: string }` — `10:40` / `9:05` / `1040` / `905` / `10時40分` / `10時`（全角可）→ `'HH:MM'`（2桁）。時 0〜23・分 0〜59 以外はエラー
  - `SlotRequest` に `reception: string | null` を追加

- [ ] **Step 1: 失敗するテストを書く**
  - `parseTime('10:40')`, `('１０：４０')`, `('1040')`, `('10時40分')` → `{ ok: true, time: '10:40' }`。`('905')` → `'09:05'`。`('10時')` → `'10:00'`
  - `parseTime('24:00')`, `('10:60')`, `('abc')` → `ok: false`
  - `parseApplyInput({ month: '2027-01', a1_venue: '竜星の嵐新宿店', a1_date: '10', a1_reception: '10:40' }, names)` → `requests[0].reception === '10:40'`。`a1_reception` 空欄 → `null`
  - 会場・日付なしで `a1_reception: '10:40'` → `ok: false`、メッセージに `A①`
  - `a1_reception: '25:00'` → `ok: false`
  - `workflow.test.ts`: 入力は20個、`${slot}_reception` を含む

- [ ] **Step 2: `npx vitest run src/apply` で失敗を確認**

- [ ] **Step 3: 実装**
  - `input.ts`: `parseTime` と `reception` の解釈。会場・日付・受付すべて空欄の枠だけを飛ばす
  - `apply.yml`: 各 `xN_date` の直後に `xN_reception`（`description: 'A① 受付開始（空欄＝会場の時刻。10:40）'`, `type: string`）と `INPUT_XN_RECEPTION` の env を足す
  - `apply.ts`: `parseApplyInput` の後、ログイン前に reception のある request ごとに `shiftVenue` を呼び、失敗は `${slotLabel}: ${message}` を集めて全部出して `process.exit(1)`。`buildFields` 呼び出しに `request.reception` を渡す
  - `CLAUDE.md` の自動申請節と元の設計書の「使い方」（入力の表・入力数20）に受付開始を書き足す

- [ ] **Step 4: `npm test` と `npm run build` が通る**

- [ ] **Step 5: Commit** `feat: add per-slot reception time input to apply workflow`
