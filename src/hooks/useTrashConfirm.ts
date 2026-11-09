import { createElement, type ReactElement, useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { trashConfirmLines, trashConfirmTitle } from "../utils/trashConfirm";

type Pending = { paths: string[]; resolve: (ok: boolean) => void };

/**
 * ゴミ箱移動の確認をアプリ内ダイアログで取る。
 * `confirm(paths)` は利用者が選ぶまで待ち、`dialog` を描画ツリーに置く。
 */
export function useTrashConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback((paths: string[]) => {
    // 既に開いていれば前の問い合わせは取り消し扱いにする
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { paths, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const dialog: ReactElement | null = pending
    ? createElement(ConfirmDialog, {
        title: trashConfirmTitle(pending.paths.length),
        lines: trashConfirmLines(pending.paths),
        confirmLabel: "ゴミ箱に移動",
        danger: true,
        onConfirm: () => settle(true),
        onCancel: () => settle(false),
      })
    : null;

  return { confirm, dialog };
}
