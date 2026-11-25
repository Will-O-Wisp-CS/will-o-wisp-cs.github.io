# 大会告知画像の生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run announce -- 2026-11` で、その月の鬼火CS の大会ごとの告知画像（1200×675 PNG）を作り、クラウドの Claude がスキルとして使えるようにする。

**Architecture:** `src/announce/` に、大会 → 画像の文字（純粋関数）、文字 → SVG（純粋関数）、SVG → PNG の Node 専用スクリプトの3層を置く。PNG にするのは `@resvg/resvg-js` で、フォントはリポジトリ内のファイルだけを使う。祝日判定と受付時刻は `shared/` に移して共用する。

**Tech Stack:** Node 22 / TypeScript strict（Node が型を取り除いて直接実行）/ vitest / `@resvg/resvg-js`（devDependency）

**Spec:** `docs/superpowers/specs/2026-11-25-announce-image-design.md`

## Global Constraints

- 画像は 1200×675。見た目は `output/11月イベント画像/2026-11-29_1220_フルコンプ千葉店.png` と同じ（左下に 日付・曜日の四角・「受付 HH:MM~」、その下に「鬼火CS in ○○」、下の方は黒へのグラデーション）
- 曜日の四角: 土＝青、日＝赤、祝日＝黄（文字は黒）、平日＝四角なしで曜日の文字だけ。祝日を優先する
- 受付 = 開始の20分前（`RECEPTION_MINUTES_BEFORE = 20`）
- 大会データ = `events.json` と `events-archive.json` を `mergeEventLists` したもの
- ブラウザ・OS のフォント・ネットワークに頼らない（`loadSystemFonts: false`）
- 機能フォルダ同士は import しない。Node で直接実行するファイルから import されるファイルの import は `.ts` 拡張子付き
- ルート直下にファイル・フォルダを増やさない。テストは対象の隣に `*.test.ts`
- テスト名・コメント・出力メッセージは日本語。コミットは `feat:` などの接頭辞付き英語
- 出力先は `src/announce/out/<YYYY-MM>/<YYYY-MM-DD>_<HHMM>_<開催地>.png`（`HHMM` は開始時刻）。`src/announce/out/` は `.gitignore` に入れる
- 画像は `main` にコミットしない

## Review Focus

- 大会名が「【ミニ】鬼火CS in ○○」のように `venue` に「鬼火CS」が入っている大会（記録に実在）→ タイトルは「鬼火CS in 鬼火CS…」と二重にせず `venue` をそのまま使う（Task 1 にテスト）
- 開催地名が長い（例: 「竜星のPAO秋葉原ロケット無線店」）→ 画像からはみ出さない。幅を超えるときは文字を縮める（Task 2 にテスト）
- 開催地名に `&`・`<` などが入る → SVG が壊れない（Task 2 にテスト）
- 指定した月に大会がない／終わった大会しかない → エラーにせず「作る画像がありません」と出して exit 0（Task 3）
- フォントにない字 → 豆腐にならないよう、フォントはサブセット化せず全体を入れる（Task 2）

---

### Task 1: 祝日・受付時刻の共用化と、画像に載せる文字

**Files:**
- Move: `src/schedule/calendar.ts` → `src/shared/calendar.ts`、`src/schedule/calendar.test.ts` → `src/shared/calendar.test.ts`（中身はそのまま。`src/schedule/main.ts` の import を直す）
- Modify: `src/shared/events.ts`（`RECEPTION_MINUTES_BEFORE` と `receptionStart` を追加）
- Modify: `src/schedule/schedule.ts`（`RECEPTION_MINUTES_BEFORE` を shared から re-export し、`receptionWindow` は `receptionStart` を使う。既存テストはそのまま通ること）
- Create: `src/announce/announce.ts`, `src/announce/announce.test.ts`

**Interfaces:**
- Produces:
  - `shared/events.ts`: `export const RECEPTION_MINUTES_BEFORE = 20`、`export function receptionStart(start: string): string`（'12:20' → '12:00'。日をまたいでも 0:00〜23:59 に収める）
  - `shared/calendar.ts`: `dayKind(iso): DayKind`, `holidayName(iso)`（今と同じ）
  - `announce/announce.ts`:
    ```ts
    export type AnnounceText = {
      date: string;        // '11/29'（ゼロ埋めしない。'12/3'）
      weekday: string;     // '日'
      dayKind: DayKind;
      reception: string;   // '12:00~'
      title: string;       // '鬼火CS in フルコンプ千葉店'
      fileName: string;    // '2026-11-29_1220_フルコンプ千葉店.png'
    };
    export function announceText(e: ScheduleEvent, receptionOverride?: string): AnnounceText;
    export function eventsInMonth(events: ScheduleEvent[], month: string, today: string): ScheduleEvent[];
    ```

- [ ] **Step 1: テストを書く**（`announce.test.ts`）
  - `announceText({date:'2026-11-29', start:'12:20', venue:'フルコンプ千葉店', ...})` → `{date:'11/29', weekday:'日', dayKind:'sunday', reception:'12:00~', title:'鬼火CS in フルコンプ千葉店', fileName:'2026-11-29_1220_フルコンプ千葉店.png'}`
  - `'2026-11-03'`（文化の日・火）→ `dayKind:'holiday'`, `weekday:'火'`、`'2026-12-03'` → `date:'12/3'`
  - `'2026-11-28'` → `dayKind:'saturday'`、`'2026-11-26'` → `'weekday'`
  - `receptionOverride:'12:10'` → `reception:'12:10~'`
  - venue が `'【ミニ】鬼火CS in 晴れる屋3'` → `title` はそのまま `'【ミニ】鬼火CS in 晴れる屋3'`
  - venue に `/` が入る → `fileName` では `_` に置き換わる
  - `eventsInMonth`: 月が違う大会、`today` より前の大会は除き、日付・開始時刻順に並ぶ
  - `shared/events.test.ts` に `receptionStart('10:30')==='10:10'`、`receptionStart('00:10')==='23:50'`
- [ ] **Step 2: `npx vitest run src/announce src/shared` で失敗を確認**
- [ ] **Step 3: 実装**（`calendar.ts` の移動、`receptionStart`、`announce.ts`。import は `.ts` 付き）
- [ ] **Step 4: `npm test` と `npx tsc` がすべて通ることを確認**
- [ ] **Step 5: コミット** `feat: add announce image text from schedule events`

### Task 2: 素材・SVG のひな形

**Files:**
- Create: `src/announce/assets/key-visual.jpg`（`C:\Users\dhuer\Downloads\S__127262729.jpg` をコピー。1655×988）
- Create: `src/announce/assets/fonts/`（日本語の太字（例: Noto Sans JP Black）と、日付・時刻用の縦長の太い数字（例: Oswald Bold や Bebas Neue）。OFL のもの。`OFL.txt` も置く。サブセット化しない）
- Create: `src/announce/template.ts`, `src/announce/template.test.ts`

**Interfaces:**
- Consumes: `AnnounceText`（Task 1）
- Produces:
  ```ts
  export const WIDTH = 1200, HEIGHT = 675;
  export const FONT_JP: string;      // SVG の font-family 名（フォントファイル内の名前と一致させる）
  export const FONT_DIGITS: string;
  export function announceSvg(t: AnnounceText, background: string): string; // background は href（data URI）
  ```

- [ ] **Step 1: テストを書く**（`template.test.ts`）
  - 返り値が `width="1200" height="675"` の `<svg` で始まる
  - `t.date`・`t.reception`・`t.title` が入っている
  - `dayKind:'sunday'` は赤、`'saturday'` は青、`'holiday'` は黄の四角（`style.css` の色の値と同じものを定数で持つ）。`'weekday'` は四角の `rect` がない
  - title `'A&B<C'` → `A&amp;B&lt;C` にエスケープされる
  - 長い title（`'鬼火CS in 竜星のPAO秋葉原ロケット無線店'` の2倍の長さ）→ title の `font-size` が通常より小さい（全角1文字＝font-size、半角＝0.6倍で幅を見積もり、1100px に収める）
- [ ] **Step 2: 失敗を確認**（`npx vitest run src/announce/template.test.ts`）
- [ ] **Step 3: 実装**。背景は幅1200に縮めて上に置き（高さ約716、下をはみ出させる）、下半分に透明→黒（不透明度0.85程度）の linearGradient を重ねる。文字の位置は Global Constraints の参考 PNG に合わせる（日付は x=50・ベースライン y≈535 で高さ約100px、title は y≈625 で約44px の白字）
- [ ] **Step 4: テストが通ることを確認**
- [ ] **Step 5: コミット** `feat: add announce image svg template and assets`

### Task 3: PNG を書き出すスクリプト

**Files:**
- Create: `src/announce/render.ts`（Node 専用。テストなし。ロジックは Task 1・2 の関数に置く）
- Modify: `package.json`（`"announce": "node src/announce/render.ts"`、devDependency に `@resvg/resvg-js`）
- Modify: `.gitignore`（`src/announce/out/`）

**Interfaces:**
- Consumes: `eventsInMonth`, `announceText`, `announceSvg`, `mergeEventLists`
- CLI: `npm run announce -- <YYYY-MM> [--date YYYY-MM-DD] [--venue 部分一致] [--reception HH:MM]`
  - `today` は JST の今日。`--date` を付けたときは過去の大会も作れる
  - 書き出したファイルのパスを1行ずつ出す。対象がなければ「作る画像がありません」を出して exit 0。引数が違えば使い方を出して exit 1

- [ ] **Step 1: 実装**。`Resvg` に `font: { fontFiles: [...assets/fonts], loadSystemFonts: false, defaultFontFamily: FONT_JP }` を渡す。背景は `readFile` して `data:image/jpeg;base64,...`
- [ ] **Step 2: `npm run announce -- 2026-11 --date 2026-11-29` を実行し、`src/announce/out/2026-11/2026-11-29_1220_フルコンプ千葉店.png` が 1200×675 でできることを確認**
- [ ] **Step 3: できた画像と `output/11月イベント画像/2026-11-29_1220_フルコンプ千葉店.png` を見比べ、位置・大きさ・色を調整**（土・祝日・平日・長い開催地名の大会も1枚ずつ作って確認する。例: `--date 2026-11-28 --venue PAO`, `--date 2026-11-03`, `--date 2026-11-26`）
- [ ] **Step 4: `npm test`・`npm run build` が通ることを確認**
- [ ] **Step 5: コミット** `feat: add announce image render script`

### Task 4: クラウドの Claude 用のスキルと CLAUDE.md

**Files:**
- Create: `.claude/skills/cs-announce-image/SKILL.md`（`.claude/skills/cs-schedule-csv/SKILL.md` の書き方にそろえる）
- Modify: `.claude/CLAUDE.md`（コマンド一覧、フォルダ構成の `announce/`、ドメインルールに「大会告知画像」の節）

SKILL.md に書くこと:
- description: 「11月の告知画像作って」「29日の大会の画像」「告知画像を作り直して（受付12:10で）」などで必ず使う
- 手順: `npm ci`（未実行なら）→ `npm run announce -- <月> [...]` → 作業ブランチが `main` なら止めて新しいブランチを切る → `git add -f src/announce/out/...` → コミット `chore: add announce images for <月>` → push → `https://raw.githubusercontent.com/Will-O-Wisp-CS/will-o-wisp-cs.github.io/<ブランチ>/src/announce/out/...` のリンクを、日付・開催地とあわせて一覧でチャットに出す（日本語のファイル名は URL エンコードする）
- そのブランチはマージしない・PR を作らない
- 大会の時刻などが `events.json` と違うときは `--reception` で上書きし、`events.json` は手で直さない

- [ ] **Step 1: SKILL.md と CLAUDE.md を書く**
- [ ] **Step 2: スキルの手順どおりに、ローカルで 2026-12 の画像を作るところまで（push の前まで）動くことを確認**
- [ ] **Step 3: コミット** `feat: add cs-announce-image skill for cloud sessions`
