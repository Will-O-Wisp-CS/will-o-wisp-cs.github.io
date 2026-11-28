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
npm run apply   # 公認CSサポートの申請（Node 専用。普段は GitHub Actions の「大会を申請」から実行）
```

`main` への push で `.github/workflows/deploy.yml` が test → build → Pages デプロイを行う。
同じワークフローが毎日 0:00 JST（cron `0 15 * * *`）に `fetch-schedule` を実行し、`events.json` か `events-archive.json` が変わったときだけ bot がコミットしてデプロイする。

## フォルダ構成

```
.claude/     CLAUDE.md（このファイル）、launch.json（開発サーバー設定。git 管理外）、skills/cs-schedule-csv（月別大会一覧 CSV のスキル）、skills/sugatool-cover（スガツールのカバー画像のスキル。背景 background.png と cover.ts）
.github/     GitHub Actions（Pages デプロイ）
docs/superpowers/specs, plans   設計書と実装計画
src/         Vite の root。HTML・ソース・テストはすべてここ
  index.html メインページ。各ページの HTML は機能フォルダの index.html（すべて vite.config.ts の rolldownOptions.input に登録）
  home/      メインページ: main.ts(メニュー・参加表明リンク・マッチングサイトに割り当てる大会) / icon.jpg(公式Xのアイコン)
  finals/    進出人数計算: index.html / main.ts(DOM) / input.ts / tournament.ts / swiss.ts / finals.ts / format.ts
  points/    ポイント計算: index.html / main.ts(DOM) / input.ts / points.ts
  schedule/  大会スケジュール: index.html / main.ts(DOM) / parse.ts / schedule.ts / fetch.ts(Node専用の取得スクリプト) / archive.ts(大会の記録) / csv.ts + export-csv.ts(月別 CSV 出力)
  tax/       帳簿: index.html / main.ts(ログイン・タブ) / view-*.ts(各画面) / ui.ts(画面部品) / app.ts(画面間の型) / ledger.ts(型・勘定科目) / journal.ts(入力→仕訳) / travel.ts(旅費交通費のテンプレ・往復) / busy.ts(保存中の表示) / queue.ts(保存の順番待ち) / reminder.ts(開催の取り込み・リマインド) / report.ts(決算) / judges.ts + view-judges.ts(ジャッジの割り当て) / search.ts / csv.ts / receipt.ts / format.ts / drive.ts(Google 連携) / store.ts(帳簿の読み書き) / config.ts(OAuth クライアント ID)
  apply/     公認CSサポートの自動申請（画面なし・Node 専用）: apply.ts(Playwright の入口) / input.ts(Run workflow の入力) / fields.ts(会場のひな形→画面の値) / menu.ts(管理画面の読み取り) / plan.ts(枠の割り当て) / summary.ts(状態表) / venues.json(会場のひな形)
  shared/    全ページ共通: dom.ts(el, card) / calendar.ts(祝日) / csv.ts(BOM 付き CSV) / menu.ts(ハンバーガーメニュー) / entryLink.ts / parse.ts(ParseResult) / events.ts(ScheduleEvent, 次の開催日) / events.json(大会スケジュールの取得結果) / events-archive.json(大会の記録。過去の月も含む) / style.css
ルート直下のファイル   package.json, package-lock.json, tsconfig.json, vite.config.ts, .gitignore のみ
```

- ルート直下にはツールが要求する設定ファイル以外を置かない。フォルダも増やさない
- テストは対象ファイルの隣に `*.test.ts` として置く（例: `src/points/points.test.ts`）
- 各機能は `main.ts` だけが DOM を触り（帳簿は画面が多いので `main.ts`・`view-*.ts`・`ui.ts`）、計算・パースは純粋関数に分けてテストする
- 機能フォルダ同士は import しない。共通のものは `shared/` に置く
- ページを追加するときは `src/<名前>/index.html` を作り、`vite.config.ts` の input、`src/shared/menu.ts` の `SITE_PAGES`、メインページ（`src/index.html`）のカードに追加する。公開URLは `/<名前>/`
- ページ間の移動は上部の帯の右端のハンバーガーメニュー（`mountSiteMenu(ページID)` を各 `main.ts` で呼ぶ）
- `base` は `/`。ページ間のリンクは `/finals/` のような絶対パスで書く。各ページの見出し上の「← 鬼火CS トップ」でメインに戻る
- メインページのマッチングサイトのカードは https://sugatool.nojigikucs.com/orgs/will_o_wisp_cs へのリンク1枚。説明には JST の今日以降で一番近い開催日と、その日の開催地（大会詳細ページへのリンク）を開始時刻順に「 / 」区切りで出す
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
- 開催日は黒文字＋マーカー（土＝青 / 日＝赤 / 祝日＝黄 / 平日＝なし、祝日優先）。祝日は外部データを使わず `shared/calendar.ts` で計算する
- 参加表明は開催日14日前の20:00 JST〜大会開始時刻。ページを開いた時点で判定する
- 大会がすべて開催済みになった月は表示しない
- `fetch.ts`・`export-csv.ts` は Node で型を取り除いて直接実行するため、これらから import されるファイル内の import は `.ts` 拡張子付きで書く
- 月別 CSV は BOM 付き UTF-8・CRLF（Excel 向け）。承認「◎」のみ。検索は `EventFrom`〜`EventTo` で月を指定するので過去の月も出せる
- `events.json`・`events-archive.json` は bot が更新する。手で編集しない
- 大会の記録（`events-archive.json`）は帳簿用。`fetch-schedule` が毎回の取得結果を足し（消さない）、記録にない 2026-01〜先月の月は月ごとに取りに行く（取得済みの月は `months` に持ち二度は取らない）

### 帳簿（詳細は docs/superpowers/specs/2026-10-07-tax-ledger-design.md）
- 帳簿・領収書は本人の Google ドライブの「鬼火CS帳簿」フォルダにだけ保存する。リポジトリや localStorage に入れない
- OAuth スコープは `drive.file` のみ。同意画面は「テスト」のまま、テストユーザーは本人だけ。ページ内での ID・パスワード照合はしない
- 1取引＝1仕訳。金額は整数（円）。会場費＝地代家賃、賞品代＝広告宣伝費、外注費（ジャッジ・スタッフへの報酬）＝外注工賃
- 科目を足したら、保存済みの設定の並び（`expenseOrder`）にない科目は `expenseOrderOf` で最後に足して表示する
- 経費の支払方法は 現金 / 普通預金 / 個人のお金 / クレカ / PayPay / 交通系IC。クレカ・PayPay・交通系IC は個人のもの（事業主借）として記帳し、どれで払ったかを `payment` に残す
- 経費の入力欄は 開催 → 日付 → 科目 → 金額 → 支払方法 → 取引先 → メモ → 領収書。旅費交通費を選ぶと支払方法の初期値は交通系IC。設定の `travelTemplates`（区間・片道運賃）から金額を選べ、往復は同じ内容で2件保存する（領収書は1件目だけ）
- 一覧の開催ごとの収支は 売上 / 広告宣伝費 / 外注工賃 / 旅費交通費 / 差額（ほかの経費を付けた開催だけ「その他」も）。差額はひも付いた経費をすべて引く
- ログイン・読み込み・帳簿の作成・保存の間は、画面の前面にスピナーと文言（「ログインしています…」「読み込んでいます…」「保存しています…」など。`busy.ts`）を出してほかの操作を止める。売上のついでの参加費の初期値の更新は裏で行い出さない。帳簿の保存に成功したらページ上部に戻って「保存しました」を出す
- 開催の ID は大会詳細ページの URL。帳簿は `events-archive.json` と `events.json` を合わせて取り込む。どちらから消えた開催も帳簿には残す
- 保存前にドライブ上の中身の `rev`（保存ごとに +1）を比べ、違えば保存しない（他の端末での更新）。ドライブのファイルの version は勝手に増えるので使わない
- ジャッジタブは開催ごとの HJ・FJ を `judges.json`（帳簿とは別ファイル。`rev` の比較は同じ、バックアップなし）に保存する。表は今月以降の開催を月ごとに出し、受付開始は開始の20分前。プルダウンの候補は設定の `judgeNames`、会場名の色は設定の `venueColors`（選んでいない会場は `judges.ts` の初期値の色）。手入力した名前は候補に足さない（詳細は docs/superpowers/specs/2026-11-03-judge-assignments-design.md）
- `backup/` に直前の版を残すのは、ページを開いて最初の保存とその後1時間ごと（年ごとに30件）。保存のたびに取ると遅いため。領収書は同時にアップロードし、フォルダはログイン後に先読みする

### 自動申請（詳細は docs/superpowers/specs/2026-11-17-dmp-apply-design.md）
- `.github/workflows/apply.yml`（「大会を申請」、手動実行のみ）で、6枠（A①〜C②。3アカウント×月2回）に会場と日付を指定して「公認CSサポートYYYY年M月開催申請」を出す。全部「なし」で実行すると状態の一覧だけ
- 枠ごとに受付開始を入れると、元の受付との差だけ開始時刻・参加表明締切・タイムスケジュールの文面の時刻をずらす（`fields.ts` の `shiftVenue`）。空欄なら会場のひな形の時刻。日をまたぐなら止める
- 「確認だけ」（既定）は入力まで。〔更新保存〕だけでは申請にならず、〔上記内容で申請する〕まで押して初めて申請になる
- ログイン情報・担当者メールアドレスは Secrets（`DMP_A_ID` / `DMP_A_PASSWORD` 〜 C、`DMP_CONTACT_MAIL`）。ログ・状態表・リポジトリに出さない。スクリーンショットはメール欄を隠し、artifact は1日で消す
- 参加表明・デッキ提出の開始＝開催日14日前 20:00、参加表明締切＝受付開始の10分前、デッキ提出締切＝開催日 23:59。ジャッジは毎回 06012
- 会場を足すときは `venues.json` と `apply.yml` の6つの会場の選択肢をそろえる（ずれるとテストが落ちる）
- アカウントの空き枠が足りない・保存のみ（未申請）の開催がある月は、勝手に選ばずそのアカウントの指定をすべて飛ばす

### スガツールのカバー画像
- 「カバー画像」「スガツール画像」と言われたら `.claude/skills/sugatool-cover` のスキルで作る。デザインを新しく考えない
- 1200×675。背景は `background.png`、左下に 日付（M/D）・曜日バッジ（土＝青 / 日・祝＝赤 / 平日＝灰）・「受付 H:MM~」（開始の20分前）・「鬼火CS in ○○」
