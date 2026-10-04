# スガツール イベント一括作成スクリプト 設計書

- 作成日: 2026-10-04
- 状態: 承認済み

## Context
鬼火CSのマッチングサイトは スガツール（https://sugatool.nojigikucs.com/orgs/will_o_wisp_cs）のイベントページ。
これまで大会ごとに作成画面で手入力していたものを、**月単位で一括作成**する Node スクリプトにする。
値は dmp-ranking.com の大会詳細ページ（大会スケジュールの各行のリンク先）から取る。テンプレート機能は使わない。

## 使い方
```bash
npm run create-events -- 2026-11            # 作成予定の一覧を表示するだけ（何も作らない）
npm run create-events -- 2026-11 --commit   # 実際に作成する
```
- 環境変数 `SUGATOOL_TOKEN` と `SUGATOOL_USER_ID` が必要（`--commit` なしでも必須にしない。一覧表示は公開 API だけで動く）
  - スガツールにログインしたブラウザの開発者ツールで `localStorage.token` と `JSON.parse(localStorage.user).userId`
  - `--commit` で未設定ならこの取得方法を含むエラーメッセージを出して exit 1
- LINE ログインは利用者本人が行う。スクリプトはログインしない

## スガツール API（非公式。画面の JS から読み取ったもの）
- ベース: `https://boi0m28318.execute-api.ap-northeast-1.amazonaws.com/v1/prod`
- `GET /events?orgId=will_o_wisp_cs` — 団体のイベント一覧（認証不要）。各要素に `name` / `eventDate`
- `POST /events` — 作成。ヘッダー `Authorization: Bearer <token>`、本文 JSON。成功時は `eventId` を含む
- エラー時は本文の `message` を表示する
- スガツール側の更新で動かなくなることがある前提

## 処理の流れ
1. 月を `parseMonth` で解釈し、`monthRange` + `entrySearchUrl` で dmp-ranking を検索（`export-csv` と同じ。承認「◎」のみ、指定月以外は除く）
2. 大会ごとに `ScheduleEvent.url`（大会詳細ページ、Shift_JIS）を取得し `parseEventDetail` でパース
3. `GET /events?orgId=will_o_wisp_cs` で既存イベントを取得し、**大会名と開催日が同じものはスキップ**
4. 1件ずつ「開催日 / 大会名 / 定員 / 参加費 / ラウンド数 / 決勝人数 / タイマー」と状態（作成予定・スキップ・読み取り失敗）を表示
5. `--commit` のときだけ作成予定を `POST /events`。1件失敗しても残りを続ける
6. 最後に 作成・スキップ・失敗 の件数を表示。失敗が1件でもあれば exit 1

料金: スガツールのトライアルは 2026-10-31 開催分まで。それ以降の大会も区別せず送信し、エラーが返ればその `message` を表示する。料金プランの情報（`billingPlan`）は送らない。

## 大会詳細ページのパース（`detail.ts`）
`event.asp?ShopID=..&EventID=..&Seq=..` の HTML（Shift_JIS をデコード済みの文字列）から読む。タグを除いたテキストに対して次を探す。

| 値 | 探す文字列 | 例 |
|---|---|---|
| 大会名 | ページ見出しの大会名（`開催日：` の直前の行） | 鬼火CS in 竜星の嵐新宿店 |
| 開催日 | `開催日： 2026/10/04` | `2026-10-04` |
| フォーマット | `フォーマット： オリジナル` | オリジナル |
| 参加費 | `参加費： 1500円` | 1500 |
| 定員 | `定員： 80人` | 80 |
| ラウンド数 | `ラウンド数：5回戦` | 5 |
| 決勝人数 | `上位16名` | 16 |
| 制限時間 | 「■予選」の後の最初の `制限時間：20分` | 20 |

- NFKC 正規化してから読む（全角数字・全角コロン対策）
- 1つでも読めなければ `ParseResult` の失敗（どの項目が読めなかったか）を返す。その大会は作成しない
- フォーマットは `オリジナル` → `original` のみ対応。それ以外は失敗にする（スガツールの値が未確認のため）

## 作成データ（`sugatool.ts`）
`toCreatePayload(detail, userId)` は次の JSON を返す純粋関数。

| キー | 値 |
|---|---|
| `orgId` | `'will_o_wisp_cs'` |
| `userId` | 引数 |
| `name` / `eventDate` | 詳細ページ |
| `gameTitle` | `'dm'` |
| `gameFormat` | `['original']` |
| `visibility` | `'public'` |
| `isTest` | `false` |
| `maxParticipants` | 定員 |
| `seatStart` / `seatEnd` | `1` / `Math.ceil(定員 / 2)`（作成画面と同じ） |
| `format` | `'hybrid'`（スイス＋トーナメント） |
| `teamMode` | `'individual'` |
| `maxRounds` | ラウンド数 |
| `drawPoints` | `0` |
| `autoDropLosses` | 送らない（なし） |
| `tournamentType` | `'single'` |
| `thirdPlaceMatch` | `false` |
| `topCut` | 決勝人数 |
| `shuffleTopCutSeeds` | `false` |
| `seatTimerMinutes` | 制限時間 |
| `entryFee` | 参加費 |
| `dmpRankingEligible` / `dmpCertifiedJudge` | `true` / `true` |
| `description` | `''` |
| `dmpRankingDeckListViewUrl` / `dmpRankingDlo` | `null` / `null` |

`isDuplicate(detail, existing)` — `existing` に `name` と `eventDate` が両方一致するものがあれば true。

## 自動化しないもの（作成後に手で設定）
- 運営メンバーの追加（作成者のみが運営になる）
- 申込フォームの項目（遅刻連絡の規約文など）。スガツールの既定値になる
- カバー画像

## 構成
- `src/schedule/detail.ts` + `detail.test.ts` — `parseEventDetail(html)`
- `src/schedule/sugatool.ts` + `sugatool.test.ts` — `toCreatePayload` / `isDuplicate` / 型 `EventDetail`・`SugatoolEvent`
- `src/schedule/create-events.ts` — Node 専用スクリプト（取得・表示・送信）。`package.json` に `"create-events": "node src/schedule/create-events.ts"`
- Node で直接実行するため、これらの import は `.ts` 拡張子付き
- テストの HTML は実ページから必要部分を切り出してテスト内に文字列で置く

## テスト
- `parseEventDetail`: 実ページ相当の HTML で全項目が取れる / 全角数字 / 項目欠落時に失敗とその項目名 / 本戦の制限時間を拾わない / オリジナル以外は失敗
- `toCreatePayload`: 上表どおり、席番号の切り上げ（奇数定員）
- `isDuplicate`: 名前・日付の一致 / 片方だけ一致は false
- スクリプト本体（通信部分）は自動テストしない。`--commit` なしの実行で一覧を目視確認する
