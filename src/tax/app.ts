import type { Ledger, Settings } from './ledger';
import type { Loaded } from './store';

/** 入力タブを開いたときのフォーム（売上の開催、または編集する取引） */
export type InputContext = { mode: 'sale'; eventId: string } | { mode: 'edit'; id: string } | null;

/** main.ts が持つ状態と、各画面（view-*.ts）から呼べる操作 */
export type App = {
  settings: Loaded<Settings>;
  ledger: Loaded<Ledger>;
  /** 入力タブのフォーム。保存に成功したら入力画面側で null に戻す */
  inputContext: InputContext;
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
  /** エラーを表示する */
  fail(error: unknown): void;
};
