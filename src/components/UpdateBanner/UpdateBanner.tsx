import type { UpdateState } from "../../utils/updateState";

export type UpdateBannerProps = {
  state: UpdateState;
  onInstall: () => void;
  onRestart: () => void;
  onRetry: () => void;
  onDismiss: () => void;
};

function percent(downloaded: number, total: number | null): number | null {
  if (total === null || total <= 0) return null;
  return Math.min(100, Math.floor((downloaded / total) * 100));
}

/** ツールバー右側に出すアップデート状態バナー。idle と自動確認中は何も描画しない。 */
export function UpdateBanner({
  state,
  onInstall,
  onRestart,
  onRetry,
  onDismiss,
}: UpdateBannerProps) {
  switch (state.status) {
    case "idle":
      return null;

    case "checking":
      if (!state.manual) return null;
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span>Checking for updates…</span>
        </output>
      );

    case "upToDate":
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span>You're up to date</span>
        </output>
      );

    case "available":
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span>v{state.update.version} is available</span>
          <button type="button" className="update-banner__btn" onClick={onInstall}>
            Update
          </button>
          <button type="button" className="toolbar__error-close" onClick={onDismiss}>
            ×
          </button>
        </output>
      );

    case "downloading": {
      const pct = percent(state.downloaded, state.total);
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span>
            Downloading v{state.update.version}…{pct !== null ? ` ${pct}%` : ""}
          </span>
          <div
            className={`update-banner__progress ${pct === null ? "update-banner__progress--indeterminate" : ""}`}
          >
            <div className="update-banner__progress-bar" style={{ width: `${pct ?? 40}%` }} />
          </div>
        </output>
      );
    }

    case "ready":
      return (
        <output className="toolbar__error update-banner update-banner--neutral">
          <span>v{state.update.version} installed. Restart to finish</span>
          <button type="button" className="update-banner__btn" onClick={onRestart}>
            Restart
          </button>
        </output>
      );

    case "error":
      return (
        <div className="toolbar__error update-banner" role="alert">
          <span>
            {state.retry === null
              ? `Update failed: ${state.message}. Please restart mekuri manually`
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
