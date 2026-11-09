import type { SiblingNavigation } from "../../types";
import { ChevronDown, ChevronUp } from "../Icons/Icons";

type ViewerNoticeProps = {
  /** 人向けの一次文 */
  title: string;
  /** 生メッセージなどの詳細。折りたたんで表示する */
  detail?: string;
  tone: "error" | "empty";
  siblingNav: SiblingNavigation;
  onClose: () => void;
};

/**
 * ビューワーで内容を表示できないときの画面。エラーでも空でも、
 * 前後のファイルへ進む手段と閉じる手段を残す。
 */
export function ViewerNotice({ title, detail, tone, siblingNav, onClose }: ViewerNoticeProps) {
  return (
    <div
      className={`viewer-notice viewer-notice--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="viewer-notice__body">
        <p className="viewer-notice__title">{title}</p>
        {detail && (
          <details className="viewer-notice__details">
            <summary>詳細</summary>
            <p className="viewer-notice__detail">{detail}</p>
          </details>
        )}
      </div>
      <div className="viewer-notice__actions">
        <button
          type="button"
          onClick={siblingNav.goPrev}
          disabled={!siblingNav.hasPrev}
          title="前のファイル (Alt+↓)"
        >
          <ChevronDown size={16} />
          前のファイル
        </button>
        <button
          type="button"
          onClick={siblingNav.goNext}
          disabled={!siblingNav.hasNext}
          title="次のファイル (Alt+↑)"
        >
          <ChevronUp size={16} />
          次のファイル
        </button>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
