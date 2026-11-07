# 鬼火CS 翌月の日程告知（Discord 通知） 設計書

- 作成日: 2026-11-07
- 状態: 承認待ち

## Context
毎月、公式X（@Will_O_Wisp_CS）に翌月の鬼火CSの日程を投稿している（画像＋各日程の dmp ランキングの URL）。
この投稿の**画像と本文を自動で作り、決まった時刻に Discord へ送る**。X への投稿は本人が手で行う。

- X API は使わない（有料のため）。ブラウザを自動操作してログイン・投稿するのは X の規約に反し、アカウントが凍結される恐れがあるのでやらない
- 本人は X Premium に入っているので、本文は長文ポスト1つにまとめる（通常アカウントの上限 280 は超える）

## いつ送るか
- **当月の鬼火CSがすべて終わった翌日の 18:00 JST** に、**翌月**の日程を送る
  - 例: 11月の最終開催日が 11/29 → 11/30 18:00 に 12月分を送る
  - 最終開催日が月末なら、翌月1日の 18:00 になる（例: 10/31 が最終 → 11/1 18:00 に 11月分）
- 判定: 「JST の昨日」が、**昨日の月の大会の最終開催日**と等しければ送る。送る月は「昨日の月の翌月」
- 大会の一覧は `events-archive.json` と `events.json` を `mergeEventLists` で合わせたもの（どちらも承認「◎」のみ）。毎日 0:00 JST に更新済みのものを使い、告知のときに取り直しはしない
- 翌月の大会が0件なら、Discord に「12月の鬼火CSはまだ登録されていません」とだけ送る
- 送ったあとに日程が変わっても、自動で送り直さない（手動で送り直す）

## 本文
```
11月の鬼火CSの日程です。
詳細は下記のdmpランキングよりご確認ください。

■3日(火・祝)
竜星のPAO千葉中央店 10:10〜10:30受付
https://www.dmp-ranking.com/event.asp?ShopID=3746&EventID=351&Seq=1

■8日(日)
竜星の嵐新宿店 10:10〜10:30受付
https://www.dmp-ranking.com/event.asp?...
フルコンプ千葉店 12:00〜12:20受付
https://www.dmp-ranking.com/event.asp?...
…

#デュエマ #鬼火CS
```
- 開催日ごとに `■D日(曜)` の見出し。祝日は `(火・祝)`。日付順、同じ日は開始時刻順
- 各大会は「開催地 受付〜開始受付」の行と、大会詳細ページの URL の行
- 受付は開始の20分前〜開始（大会スケジュールと同じ `receptionWindow`）
- 末尾に空行と `#デュエマ #鬼火CS`

## 画像
デザイン案5（キービジュアルを背景に）。1080×1350 の PNG を1枚。
- 背景は「ONIBI CHAMPIONSHIP」のキービジュアル（`src/announce/kv.jpg`）を全面に敷き、日程側（右）を黒で暗くする。キービジュアルのふちの白い余白は見えないように拡大・位置合わせする
- 左上に「鬼火CS」のロゴ（キービジュアルから切り抜いた `src/announce/logo.png`、赤地）。左下に大きな「11月」と赤い帯の「開催日程」
- 右に月のカレンダー（日曜始まり、開催日を赤で塗る）と、開催日ごとのリスト（日付・曜日、開催地、受付時間）。曜日の色は 日・祝＝赤系 / 土＝青系
- 右下に「詳細・参加表明は dmpランキングから / @Will_O_Wisp_CS」
- 件数に合わせて、リストの文字の大きさと行間を段階的に縮めて 1350px に収める（14件で余白なく収まること、1件でも間延びしないこと）。長い開催地名（例: 竜星のPAO秋葉原ロケット無線店）は1行に収まる大きさにする
- 配色: 赤 `#d31a15`、黒 `#1a1414`、白。グラデーションは日程側を暗くする1か所だけ
- フォント: Anton（数字）、Zen Kaku Gothic New（本文）、Dela Gothic One（見出し）。Google Fonts から読み込み、`document.fonts.ready` を待ってから撮る
- HTML を作る部分は純粋関数（`renderImageHtml`）にし、PNG にするのは Playwright（Chromium）で行う

## Discord への通知
- Discord のチャンネルの Webhook に送る。URL は GitHub の Secrets の `DISCORD_WEBHOOK_URL`（リポジトリは公開なので、コードやログに出さない）
- メッセージは2通
  1. 画像（`onibi-cs-YYYY-MM.png` を添付。本文は「12月の日程の告知です。画像を保存して、次のメッセージの本文と一緒に X に投稿してください」）
  2. 本文だけ（長押しでそのままコピーできるように、ほかの文字を付けない）
- 本文が Discord の上限 2000 文字を超えるときは、開催日の区切りで複数のメッセージに分ける
- 「X で投稿」リンク（intent URL）は付けない。本文を入れると 2000 文字を超えるため
- 送信に失敗したら（HTTP が 2xx 以外）exit 1 にして、Actions の失敗として見えるようにする

## 実行
- `.github/workflows/announce.yml` を新しく作る（デプロイのワークフローとは分ける）
  - 定期実行: `cron: '40 8 * * *'`（17:40 JST）。GitHub の定期実行は遅れることがあるので早めに起動し、スクリプトの中で 18:00 JST まで待ってから送る。18:00 を過ぎて起動したらすぐ送る
  - 判定で「今日は送る日でない」ならブラウザを用意せずに終わる（先に判定だけするステップを分ける）
  - 手動実行（`workflow_dispatch`）: 入力 `month`（`YYYY-MM`）を指定すると、判定と待ち時間を飛ばしてその月を今すぐ送る。試しに送るときと送り直すときに使う
  - Playwright は devDependencies に入れ、Actions では `npx playwright install --with-deps chromium` で Chromium を入れる
  - permissions は `contents: read` のみ。リポジトリには何もコミットしない
- npm スクリプト: `npm run announce`（定期実行の判定あり）、`npm run announce -- 2026-12`（指定月を今すぐ）。`--dry-run <出力先フォルダ>` で Discord に送らず、画像と本文をそのフォルダに書き出す（確認用。リポジトリの外を指定する）

## 構成
機能フォルダ同士は import しないため、告知でも使う祝日と受付時間を `shared/` に移す。
- `src/shared/calendar.ts`（`src/schedule/calendar.ts` から移動。テストも移動）
- `src/shared/events.ts` に `receptionWindow` を移す（`src/schedule/schedule.ts` から。テストも移動）。`schedule/` 側の import を直す
- `src/announce/`（ページではない。`vite.config.ts`・メニュー・トップのカードには足さない）
  - `announce.ts` — 純粋関数
    - `announceMonth(events, now)`: 送る月（`'YYYY-MM'`）か null
    - `monthEvents(events, month)`: その月の大会（日付・開始時刻順）
    - `buildPostText(month, events)`: 本文
    - `splitMessages(text, limit)`: Discord 用に分ける
    - `waitMs(now)`: 18:00 JST までのミリ秒（過ぎていれば 0）
  - `image.ts` — `renderImageHtml(month, events, assets)`：画像用の HTML（純粋関数。件数による大きさの段階もここ）
  - `run.ts` — Node 専用の実行スクリプト。JSON を読み、判定・待機・Playwright で撮影・Discord に送る。ここから import するファイル内の import は `.ts` 拡張子付き
  - `kv.jpg`, `logo.png` — キービジュアルとロゴ
- テストは隣に `*.test.ts`

## テスト
- `announceMonth`: 最終開催日の翌日だけ翌月を返す / 最終開催日の当日・翌々日は null / 最終開催日が月末なら翌月1日に返す / JST の日付で判定する（UTC 15:00 前後）/ 昨日の月に大会がなければ null
- `buildPostText`: 11月のデータで本文全体が一致 / 祝日の「・祝」/ 同じ日の複数会場の並び / 0件のとき
- `splitMessages`: 上限以下は1通 / 超えたら開催日の区切りで分ける
- `waitMs`: 17:40 → 20分 / 18:05 → 0
- `renderImageHtml`: 全大会の開催地と受付時間が含まれる / 件数で大きさの段階が変わる
- 画像の見た目は、`--dry-run` で 1件・10件（11月）・14件（12月）の PNG を作って目で確認する

## 本人がやること
- Discord で通知用チャンネルの Webhook を作り、URL を GitHub の Secrets に `DISCORD_WEBHOOK_URL` として登録する
- 届いたら、画像を保存・本文をコピーして X に投稿する

## 対象外
- X への自動投稿
- 送ったあとの日程変更の検知・再通知
- 月ごとに絵を入れ替える（竜の絵など）
