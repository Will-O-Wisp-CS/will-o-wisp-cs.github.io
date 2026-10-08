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
  /** 前年の帳簿があり、期首残高は前年の期末から自動で決まる */
  openingLocked: boolean;
  /**
   * 最新の帳簿に update をかけて保存し、再描画する。保存は1つずつ順に行う。
   * 失敗したらメッセージを出して false（入力内容は消さない）
   */
  save(update: (ledger: Ledger) => Ledger): Promise<boolean>;
  /** failureNote を渡すと、失敗してもエラーにせずその文を出す（ついでの更新用） */
  saveSettings(update: (settings: Settings) => Settings, failureNote?: string): Promise<boolean>;
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
  /** task の間、画面の前面に「保存しています…」を出す（領収書のアップロードなど save の前の処理用） */
  busy<T>(task: () => Promise<T>): Promise<T>;
};
