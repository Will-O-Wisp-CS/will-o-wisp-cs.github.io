import type { Ledger, Settings } from './ledger';
import type { Loaded } from './store';

/** main.ts が持つ状態と、各画面（view-*.ts）から呼べる操作 */
export type App = {
  settings: Loaded<Settings>;
  ledger: Loaded<Ledger>;
  /** 帳簿を保存して再描画する。失敗したらメッセージを出して false（入力内容は消さない） */
  save(ledger: Ledger): Promise<boolean>;
  saveSettings(settings: Settings): Promise<boolean>;
  /** 入力タブを開き、その開催の売上フォームにする */
  openSaleForm(eventId: string): void;
  /** 入力タブで取引を編集する */
  editTransaction(id: string): void;
  switchYear(year: number): Promise<void>;
  signOut(): void;
  /** 状態表示（エラー以外） */
  notify(message: string): void;
};
