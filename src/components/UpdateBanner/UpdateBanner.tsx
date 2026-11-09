import type { ReactElement } from "react";
import { downloadPercent } from "../../utils/updateProgress";
import type { UpdateState } from "../../utils/updateState";

export type UpdateBannerProps = {
  state: UpdateState;
  onInstall: () => void;
  onRestart: () => void;
  onRetry: () => void;
  onDismiss: () => void;
};

/** ツールバー右側に出すアップデート状態バナー。idle と自動確認中は何も描画しない。 */
export function UpdateBanner({
  state,
  onInstall,
  onRestart,
  onRetry,
  onDismiss,
}: UpdateBannerProps): ReactElement | null {
  switch (state.status) {
    case "idle":
      return null;

    case "checking":
      if (!state.manual) return null;
      return (
        <output className="toolbar__banner update-banner">
          <span className="update-banner__message">アップデートを確認中…</span>
        </output>
      );

    case "upToDate":
      return (
        <output className="toolbar__banner update-banner">
          <span className="update-banner__message">最新の状態です</span>
        </output>
      );

    case "available":
      return (
        <output className="toolbar__banner update-banner">
          <span className="update-banner__message">v{state.update.version} が利用できます</span>
          <button type="button" className="update-banner__btn" onClick={onInstall}>
            更新
          </button>
          <button
            type="button"
            className="toolbar__banner-close"
            aria-label="閉じる"
            onClick={onDismiss}
          >
            ×
          </button>
        </output>
      );

    case "downloading": {
      const pct = downloadPercent({ downloaded: state.downloaded, total: state.total });
      return (
        <output className="toolbar__banner update-banner">
          <span className="update-banner__message">
            v{state.update.version} をダウンロード中…{pct !== null ? ` ${pct}%` : ""}
          </span>
          <span
            className={`update-banner__progress ${pct === null ? "update-banner__progress--indeterminate" : ""}`}
          >
            <span className="update-banner__progress-bar" style={{ width: `${pct ?? 40}%` }} />
          </span>
        </output>
      );
    }

    case "ready":
      return (
        <output className="toolbar__banner update-banner">
          <span className="update-banner__message">
            v{state.update.version} をインストールしました。再起動して完了します
          </span>
          <button type="button" className="update-banner__btn" onClick={onRestart}>
            再起動
          </button>
        </output>
      );

    case "error":
      return (
        <div className="toolbar__banner toolbar__banner--error update-banner" role="alert">
          <span className="update-banner__message">
            {state.retry === null
              ? `アップデートは完了しましたが再起動に失敗しました: ${state.message}。mekuri を手動で再起動してください`
              : `アップデートに失敗しました: ${state.message}`}
          </span>
          {state.retry !== null && (
            <button type="button" className="update-banner__btn" onClick={onRetry}>
              再試行
            </button>
          )}
          <button
            type="button"
            className="toolbar__banner-close"
            aria-label="閉じる"
            onClick={onDismiss}
          >
            ×
          </button>
        </div>
      );
  }
}
