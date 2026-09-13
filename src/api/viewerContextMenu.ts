import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReadingDirection, ViewMode } from "../utils/spreadLayout";

export type ViewerMenuState = {
  viewMode: ViewMode;
  readingDirection: ReadingDirection;
  setViewMode: (mode: ViewMode) => void;
  toggleReadingDirection: () => void;
};

const VIEW_MODE_ITEMS: ReadonlyArray<readonly [ViewMode, string]> = [
  ["single", "単ページ表示"],
  ["spread", "見開き表示"],
  ["triple", "3ページ表示"],
  ["fit", "ウィンドウ追従表示"],
];

/** ビューワーのネイティブコンテキストメニューを表示する (表示モード・読み方向・ゴミ箱・閉じる)。 */
export async function showViewerContextMenu(
  state: ViewerMenuState | null,
  onTrash: () => void,
): Promise<void> {
  const { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem } = await import(
    "@tauri-apps/api/menu"
  );

  const modeItems = await Promise.all(
    VIEW_MODE_ITEMS.map(([mode, text]) =>
      CheckMenuItem.new({
        text,
        checked: state?.viewMode === mode,
        action: () => state?.setViewMode(mode),
      }),
    ),
  );

  const directionItem = await MenuItem.new({
    text: state?.readingDirection === "rtl" ? "左→右 (LTR) に切替" : "右→左 (RTL) に切替",
    action: () => state?.toggleReadingDirection(),
  });

  const separator = () => PredefinedMenuItem.new({ item: "Separator" });

  const trashItem = await MenuItem.new({ text: "Move to Trash", action: onTrash });
  const closeItem = await MenuItem.new({
    text: "Close Window",
    action: () => getCurrentWindow().close(),
  });

  const menu = await Menu.new({
    items: [
      ...modeItems,
      await separator(),
      directionItem,
      await separator(),
      trashItem,
      await separator(),
      closeItem,
    ],
  });
  await menu.popup();
}
