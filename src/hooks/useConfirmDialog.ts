import { createElement, type ReactElement, useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";

export type ConfirmRequest = {
  title: string;
  lines: string[];
  confirmLabel: string;
  danger?: boolean;
};

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };

/**
 * アプリ内の確認ダイアログを開き、利用者が選ぶまで待つ。
 * `confirm(request)` は選んだ結果を返し、`dialog` を描画ツリーに置く。
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback((request: ConfirmRequest) => {
    // 既に開いていれば前の問い合わせは取り消し扱いにする
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { ...request, resolve };
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
        title: pending.title,
        lines: pending.lines,
        confirmLabel: pending.confirmLabel,
        danger: pending.danger,
        onConfirm: () => settle(true),
        onCancel: () => settle(false),
      })
    : null;

  return { confirm, dialog };
}
