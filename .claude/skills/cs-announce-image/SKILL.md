---
name: cs-announce-image
description: 鬼火CSの大会ごとの告知画像（X 投稿用 1200×675 PNG。キービジュアルに日付・曜日・受付時刻・「鬼火CS in ○○」を載せたもの）を作り、スマホで開けるリンクで渡す。「11月の告知画像作って」「29日の大会の画像」「来月の告知画像」「新宿の告知画像を受付12:10で作り直して」など、鬼火CSの大会の告知画像・イベント画像・X 用の画像を作りたいときは必ずこのスキルを使う。画像を自分で描いたり HTML から撮ったりしないこと。
---

# 鬼火CS 大会告知画像

`npm run announce` で、大会スケジュール（`src/shared/events.json` と `events-archive.json`）から大会ごとの告知画像を作る。主にスマホの Claude アプリ（クラウドのセッション）から使われるので、最後は**スマホでタップして開けるリンク**で渡す。

## 手順

1. **対象を決める。** ユーザーの言葉から年月を読み取る（「来月」などは日本時間の今日を基準に。年がなければ一番近い将来のその月）。日付・開催地の指定があれば `--date YYYY-MM-DD` / `--venue 開催地の一部` に、受付時刻の指定があれば `--reception HH:MM` にする。
   - 月だけなら、その月の**今日以降**の大会すべて。開催済みの大会は `--date` を付けたときだけ作れる
2. **準備する。** `node_modules` がなければ `npm ci`。
3. **作る。** リポジトリのルートで実行する。
   ```bash
   npm run -s announce -- 2026-11
   npm run -s announce -- 2026-11 --date 2026-11-29 --reception 12:10
   ```
   作ったファイルのパスが1行ずつ出る。「作る画像がありません」ならエラーではない（その月に大会がない・もう終わった）。そのまま伝える。
4. **見て確かめる。** できた PNG を1枚以上開き、文字が欠けたり四角（豆腐）になったりしていないか見る。
5. **渡す。**
   - 今のブランチを `git branch --show-current` で確かめる。**`main` なら止めて** `git switch -c claude/announce-<月>` で新しいブランチを切る。画像は `main` に入れない
   - `git add -f src/announce/out/<YYYY-MM>/<作ったファイル>`（`out/` は .gitignore に入っているので `-f` が要る）
   - `git commit -m "chore: add announce images for <YYYY-MM>"` → `git push -u origin <ブランチ>`
   - 次の形のリンクを、日付・開催地と一緒に一覧で出す。ファイル名の日本語は URL エンコードする（`encodeURIComponent`）
     ```
     https://raw.githubusercontent.com/Will-O-Wisp-CS/will-o-wisp-cs.github.io/<ブランチ>/src/announce/out/<YYYY-MM>/<ファイル名>
     ```
   - 「リンクを開いて長押しで保存できます」と添える
   - このブランチは画像を渡すためだけのもの。**PR を作らない・マージしない**

## 大事なこと

- 大会の時刻や開催地が実際と違うときは `--reception` で上書きして作る。`events.json` / `events-archive.json` は bot が更新するので手で直さない
- 見た目（文字の位置・色・フォント）を変えたいと頼まれたら、`src/announce/template.ts` とそのテストを直す。スキルの中で SVG をその場で加工しない（次回以降も同じ見た目にするため）
- 会場の告知画像（1200×1500。概要・賞品入り）はこのスキルの対象外。頼まれたら、まだ仕組みがないことを伝える
