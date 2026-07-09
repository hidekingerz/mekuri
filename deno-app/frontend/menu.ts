/**
 * webview（フロント）側に置く Tauri 互換のメニュー shim（`@tauri-apps/api/menu` 相当）。
 *
 * Tauri 版ビューワー（`src/ViewerApp.tsx`）は `Menu`/`MenuItem`/`PredefinedMenuItem` で
 * コンテキストメニューを組み立て `menu.popup()` で表示し、各項目の `action` がクリックで
 * 実行された。Deno Desktop では次の経路へ置き換える:
 * - `popup(at)` → 項目の `action` を per-webview registry へ登録し、項目を
 *   `invoke("menu_popup", { x, y, items })` でメインへ送る。メインが
 *   `BrowserWindow.showContextMenu` でネイティブメニューを表示する（`desktop/menu.ts`）。
 * - クリックはメインが `executeJs` で `globalThis.__mekuriMenuClick(id)` を呼ぶことで届き、
 *   registry から id に対応する `action` を実行する。
 *
 * `backend/` を一切 import しないブラウザセーフなコードなので、`src/` の
 * `@tauri-apps/api/menu` import をこの shim へ差し替えれば Vite ビルドを壊さない。
 */

import { invoke as defaultInvoke, type InvokeArgs } from "./invoke.ts";

/** メニュー項目クリック時に実行されるコールバック。 */
export type MenuAction = () => void;

/** `popup` が使う invoke 関数型（テストで差し替え可能）。 */
export type MenuInvokeFn = (
  command: string,
  args?: InvokeArgs,
) => Promise<unknown>;

/** 表示位置（カーソル座標）。Tauri の popup 位置指定に相当。 */
export interface MenuPosition {
  x: number;
  y: number;
}

/** 通常のメニュー項目（クリックで `action` を実行）。 */
export interface MenuItemNode {
  __kind: "item";
  id: string;
  text: string;
  action?: MenuAction;
}

/** 区切り線。 */
export interface SeparatorNode {
  __kind: "separator";
}

export type MenuNode = MenuItemNode | SeparatorNode;

/** メインへ送るシリアライズ形（`desktop/menu.ts` の `SerializedMenuItem` と一致）。 */
type SerializedMenuItem =
  | { type: "item"; id: string; label: string }
  | { type: "separator" };

/**
 * action registry と click hook を載せるホスト（既定は webview の `globalThis`）。
 * メインプロセスが `executeJs` で `__mekuriMenuClick(id)` を呼ぶことでクリックが届く。
 */
export interface MenuHost {
  __mekuriMenuActions?: Map<string, MenuAction>;
  __mekuriMenuClick?: (id: string) => void;
}

function defaultHost(): MenuHost {
  return globalThis as unknown as MenuHost;
}

/** 単調増加する項目 id を払い出す（webview ごとにユニークであればよい）。 */
let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `mekuri-menu-${idCounter}`;
}

/**
 * ホストに action registry と click hook を用意する（初回のみ）。click hook は
 * id に対応する登録済み action を実行する。
 */
function ensureRegistry(host: MenuHost): Map<string, MenuAction> {
  const existing = host.__mekuriMenuActions;
  if (existing) return existing;

  const actions = new Map<string, MenuAction>();
  host.__mekuriMenuActions = actions;
  host.__mekuriMenuClick = (id) => {
    const action = actions.get(id);
    if (action) action();
  };
  return actions;
}

/** Tauri 互換の `MenuItem`。`new({ text, action })` で項目を生成する。 */
export const MenuItem = {
  // deno-lint-ignore require-await
  async new(
    opts: { text: string; action?: MenuAction },
  ): Promise<MenuItemNode> {
    return {
      __kind: "item",
      id: nextId(),
      text: opts.text,
      action: opts.action,
    };
  },
};

/**
 * Tauri 互換の `PredefinedMenuItem`。本アプリは `Separator` のみ使用する。
 * 未対応の predefined 項目も区切り線として扱う（機能的に無害）。
 */
export const PredefinedMenuItem = {
  // deno-lint-ignore require-await
  async new(_opts: { item: string }): Promise<SeparatorNode> {
    return { __kind: "separator" };
  },
};

/**
 * Tauri 互換の `Menu` ハンドル。`popup(at)` でメインへメニュー表示を依頼する。
 */
export class MenuHandle {
  constructor(private readonly items: readonly MenuNode[]) {}

  /**
   * コンテキストメニューを表示する。各項目の `action` をホスト registry へ登録し直し
   * （前回 popup 分はクリアして入れ替え）、項目を `menu_popup` でメインへ送る。
   * `at` 省略時は原点（テスト・フォールバック用）。
   */
  popup(
    at: MenuPosition = { x: 0, y: 0 },
    host: MenuHost = defaultHost(),
    invokeFn: MenuInvokeFn = defaultInvoke,
  ): Promise<void> {
    const actions = ensureRegistry(host);
    actions.clear();
    const serialized: SerializedMenuItem[] = [];
    for (const item of this.items) {
      if (item.__kind === "separator") {
        serialized.push({ type: "separator" });
        continue;
      }
      if (item.action) actions.set(item.id, item.action);
      serialized.push({ type: "item", id: item.id, label: item.text });
    }
    return invokeFn("menu_popup", { x: at.x, y: at.y, items: serialized }).then(
      () => {},
    );
  }
}

/** Tauri 互換の `Menu`。`new({ items })` でメニューを生成する。 */
export const Menu = {
  // deno-lint-ignore require-await
  async new(opts: { items: readonly MenuNode[] }): Promise<MenuHandle> {
    return new MenuHandle(opts.items);
  },
};
