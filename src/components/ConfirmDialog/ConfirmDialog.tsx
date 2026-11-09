import { useEffect, useRef } from "react";

export type ConfirmDialogProps = {
  title: string;
  /** 本文の行。ファイル名などを 1 行ずつ渡す */
  lines: string[];
  /** 実行ボタンの文言（例: ゴミ箱に移動） */
  confirmLabel: string;
  /** 取り消せない操作なら赤系で強調する */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * アプリ内の確認ダイアログ。既定のフォーカスはキャンセル側に置き、
 * Esc で閉じられるようにする（破壊的な操作を Enter 連打で通さない）。
 */
export function ConfirmDialog({
  title,
  lines,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`confirm-dialog${danger ? " confirm-dialog--danger" : ""}`}
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
    >
      <h2 id="confirm-dialog-title" className="confirm-dialog__title">
        {title}
      </h2>
      <ul className="confirm-dialog__lines">
        {lines.map((line) => (
          <li key={line} className="confirm-dialog__line">
            {line}
          </li>
        ))}
      </ul>
      <div className="confirm-dialog__actions">
        <button
          type="button"
          ref={cancelRef}
          className="confirm-dialog__btn confirm-dialog__btn--cancel"
          onClick={onCancel}
        >
          キャンセル
        </button>
        <button
          type="button"
          className="confirm-dialog__btn confirm-dialog__btn--confirm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
