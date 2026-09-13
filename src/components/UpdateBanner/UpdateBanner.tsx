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
        <output className="toolbar__error update-banner update-banner--neutral">
          <span className="update-banner__message">Checking for updates…</span>
        </output>
      );

    case "upToDate":
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span className="update-banner__message">You're up to date</span>
        </output>
      );

    case "available":
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span className="update-banner__message">v{state.update.version} is available</span>
          <button type="button" className="update-banner__btn" onClick={onInstall}>
            Update
          </button>
          <button type="button" className="toolbar__error-close" onClick={onDismiss}>
            ×
          </button>
        </output>
      );

    case "downloading": {
      const pct = downloadPercent({ downloaded: state.downloaded, total: state.total });
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span className="update-banner__message">
            Downloading v{state.update.version}…{pct !== null ? ` ${pct}%` : ""}
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
        <output className="toolbar__error update-banner update-banner--neutral">
          <span className="update-banner__message">
            v{state.update.version} installed. Restart to finish
          </span>
          <button type="button" className="update-banner__btn" onClick={onRestart}>
            Restart
          </button>
        </output>
      );

    case "error":
      return (
        <div className="toolbar__error update-banner" role="alert">
          <span className="update-banner__message">
            {state.retry === null
              ? `Update installed, but the restart failed: ${state.message}. Please restart mekuri manually`
              : `Update failed: ${state.message}`}
          </span>
          {state.retry !== null && (
            <button type="button" className="update-banner__btn" onClick={onRetry}>
              Retry
            </button>
          )}
          <button type="button" className="toolbar__error-close" onClick={onDismiss}>
            ×
          </button>
        </div>
      );
  }
}
