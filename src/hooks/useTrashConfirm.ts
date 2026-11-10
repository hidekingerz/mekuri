import { useCallback } from "react";
import { trashConfirmLines, trashConfirmTitle } from "../utils/trashConfirm";
import { useConfirmDialog } from "./useConfirmDialog";

/** ファイルをゴミ箱に移す前の確認。`confirm(paths)` は利用者が選ぶまで待つ。 */
export function useTrashConfirm() {
  const { confirm: ask, dialog } = useConfirmDialog();

  const confirm = useCallback(
    (paths: string[]) =>
      ask({
        title: trashConfirmTitle(paths.length),
        lines: trashConfirmLines(paths),
        confirmLabel: "ゴミ箱に移動",
        danger: true,
      }),
    [ask],
  );

  return { confirm, dialog };
}
