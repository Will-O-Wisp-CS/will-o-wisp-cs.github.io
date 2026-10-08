# 鬼火CS 計算ツール

鬼火CS（デュエル・マスターズの大会）向けの静的サイト。GitHub Pages で公開。

公開URLは https://will-o-wisp-cs.github.io/ （リポジトリ名 `will-o-wisp-cs.github.io` のユーザーサイト）。

- `/` — メインページ（公式Xのプロフィールと各ページへのカード）
- `/finals/` — 決勝トーナメント進出人数計算（スイスドロー予選の確率計算）
- `/points/` — DMPランキングポイント計算（順位・参加人数・ジャッジ有無から獲得pt）
- `/schedule/` — 鬼火CS 大会スケジュール（dmp-ranking.com の大会日程から毎日自動取得）
- `/tax/` — 主催者用の帳簿（青色申告）。データは本人の Google ドライブに保存。メニュー・トップのカードには載せない

## 技術構成

Vite 8（rolldown）+ TypeScript（strict）+ vitest。フレームワーク・ランタイム依存なし。

```bash
npm run dev     # 開発サーバー（.claude/launch.json の vite-dev は port 5173）
npm test        # vitest
npm run build   # tsc + vite build → dist/
npm run fetch-schedule   # dmp-ranking.com から src/shared/events.json を更新（Node 専用）
npm run export-csv -- 2026-10 <出力先.csv>   # 指定月の大会を「開催日,開催地,定員,受付」の CSV に（Node 専用）
```

`main` への push で `.github/workflows/deploy.yml` が test → build → Pages デプロイを行う。
同じワークフローが毎日 0:00 JST（cron `0 15 * * *`）に `fetch-schedule` を実行し、`events.json` が変わったときだけ bot がコミットしてデプロイする。

## フォルダ構成

```
.claude/     CLAUDE.md（このファイル）、launch.json（開発サーバー設定。git 管理外）、skills/cs-schedule-csv（月別大会一覧 CSV のスキル）
.github/     GitHub Actions（Pages デプロイ）
docs/superpowers/specs, plans   設計書と実装計画
src/         Vite の root。HTML・ソース・テストはすべてここ
  index.html メインページ。各ページの HTML は機能フォルダの index.html（すべて vite.config.ts の rolldownOptions.input に登録）
  home/      メインページ: main.ts(メニュー・参加表明リンク・マッチングサイトに割り当てる大会) / icon.jpg(公式Xのアイコン)
  finals/    進出人数計算: index.html / main.ts(DOM) / input.ts / tournament.ts / swiss.ts / finals.ts / format.ts
  points/    ポイント計算: index.html / main.ts(DOM) / input.ts / points.ts
  schedule/  大会スケジュール: index.html / main.ts(DOM) / parse.ts / schedule.ts / calendar.ts(祝日) / fetch.ts(Node専用の取得スクリプト) / csv.ts + export-csv.ts(月別 CSV 出力)
  tax/       帳簿: index.html / main.ts(ログイン・タブ) / view-*.ts(各画面) / ui.ts(画面部品) / app.ts(画面間の型) / ledger.ts(型・勘定科目) / journal.ts(入力→仕訳) / reminder.ts(開催の取り込み・リマインド) / report.ts(決算) / search.ts / csv.ts / receipt.ts / format.ts / drive.ts(Google 連携) / store.ts(帳簿の読み書き) / config.ts(OAuth クライアント ID)
  shared/    全ページ共通: dom.ts(el, card) / csv.ts(BOM 付き CSV) / menu.ts(ハンバーガーメニュー) / entryLink.ts / parse.ts(ParseResult) / events.ts(ScheduleEvent, 次の開催日) / events.json(大会スケジュールの取得結果) / style.css
ルート直下のファイル   package.json, package-lock.json, tsconfig.json, vite.config.ts, .gitignore のみ
```

- ルート直下にはツールが要求する設定ファイル以外を置かない。フォルダも増やさない
- テストは対象ファイルの隣に `*.test.ts` として置く（例: `src/points/points.test.ts`）
- 各機能は `main.ts` だけが DOM を触り（帳簿は画面が多いので `main.ts`・`view-*.ts`・`ui.ts`）、計算・パースは純粋関数に分けてテストする
- 機能フォルダ同士は import しない。共通のものは `shared/` に置く
- ページを追加するときは `src/<名前>/index.html` を作り、`vite.config.ts` の input、`src/shared/menu.ts` の `SITE_PAGES`、メインページ（`src/index.html`）のカードに追加する。公開URLは `/<名前>/`
- ページ間の移動は上部の帯の右端のハンバーガーメニュー（`mountSiteMenu(ページID)` を各 `main.ts` で呼ぶ）
- `base` は `/`。ページ間のリンクは `/finals/` のような絶対パスで書く。各ページの見出し上の「← 鬼火CS トップ」でメインに戻る
- メインページのマッチングサイト（午前 / 午後）のカードには、JST の今日以降で一番近い開催日の1開催目（開始時刻が早い方）を午前、2開催目を午後として開催地と大会詳細ページへのリンクを出す。2開催目がなければ午後は「開催なし」
- メインページは見出し・公式Xのプロフィールの下にマッチングサイト、その下に「その他」として各ページへのカードを並べる
- メインページの見出し下は公式Xのプロフィール（`src/home/icon.jpg` のアイコン、@will_o_wisp_cs へのリンク、フォローボタン）。X の埋め込みタイムラインはログインしていない閲覧者に表示されないため使わない

## 規約

- UI 文言・テスト名・コメントは日本語
- 入力は全角数字を受け付ける（`normalize('NFKC')`）。パース結果は `ParseResult` 型で返す
- 色は `src/shared/style.css` の CSS 変数（ライトテーマ、赤/紫/オレンジのアクセント）を使う
- コミットメッセージは `feat:` / `fix:` / `chore:` などの接頭辞付き英語

## ドメインルール

### 進出人数計算（詳細は docs/superpowers/specs/2026-09-24-swiss-draw-calculator-design.md）
- 参加人数 25〜128 人。全試合勝率 50%、引き分け・両者敗北なしを前提に厳密計算

### ポイント計算（詳細は docs/superpowers/specs/2026-09-27-ranking-points-calculator-design.md）
- 獲得pt = floor(基礎pt × 人数倍率 × ジャッジ倍率)。対象順位外・参加25人未満は 0pt
- 倍率表は公式画像（下期 DMPランキングポイント倍率）の転記。`src/points/points.ts` の `TIERS` を式で生成しない
- 浮動小数誤差を避けるため倍率は ×10 の整数で計算する
- 小数点以下の切り捨ては公式未確定。ページの前提条件にその旨を表示している
- 129〜256位の基礎ポイント10ptは公式確定済み（2026-10-01）。前提条件には表示しない

### 大会スケジュール（詳細は docs/superpowers/specs/2026-09-29-cs-schedule-design.md）
- 取得元は `schedule.asp` を大会名「鬼火」、開始日＝JSTの当月1日で検索した結果（Shift_JIS）
- 承認「◎」以外は載せない。開催地は大会名「鬼火CS in ○○」の ○○。受付は開始の20分前〜開始
- 開催日は黒文字＋マーカー（土＝青 / 日＝赤 / 祝日＝黄 / 平日＝なし、祝日優先）。祝日は外部データを使わず `calendar.ts` で計算する
- 参加表明は開催日14日前の20:00 JST〜大会開始時刻。ページを開いた時点で判定する
- 大会がすべて開催済みになった月は表示しない
- `fetch.ts`・`export-csv.ts` は Node で型を取り除いて直接実行するため、これらから import されるファイル内の import は `.ts` 拡張子付きで書く
- 月別 CSV は BOM 付き UTF-8・CRLF（Excel 向け）。承認「◎」のみ。検索は `EventFrom`〜`EventTo` で月を指定するので過去の月も出せる
- `events.json` は bot が更新する。手で編集しない

### 帳簿（詳細は docs/superpowers/specs/2026-10-07-tax-ledger-design.md）
- 帳簿・領収書は本人の Google ドライブの「鬼火CS帳簿」フォルダにだけ保存する。リポジトリや localStorage に入れない
- OAuth スコープは `drive.file` のみ。同意画面は「テスト」のまま、テストユーザーは本人だけ。ページ内での ID・パスワード照合はしない
- 1取引＝1仕訳。金額は整数（円）。会場費＝地代家賃、賞品代＝広告宣伝費
- 経費の支払方法は 現金 / 普通預金 / 個人のお金 / クレカ / PayPay / 交通系IC。クレカ・PayPay・交通系IC は個人のもの（事業主借）として記帳し、どれで払ったかを `payment` に残す
- 開催の ID は大会詳細ページの URL。`events.json` から消えた開催も帳簿には残す
- 保存前にドライブの version を比べ、違えば保存しない（他の端末での更新）。保存ごとに `backup/` に直前の版を残す（年ごとに30件）
