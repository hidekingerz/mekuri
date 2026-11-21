import type { ResolvedRecentFolder } from "../../utils/recentFolders";
import { formatOpenedAt } from "../../utils/recentFolders";
import { FolderIcon } from "../Icons/Icons";

type RecentFolderListProps = {
  entries: ResolvedRecentFolder[];
  onSelect: (entry: ResolvedRecentFolder) => void;
  /** 開いたとき最初の項目にフォーカスを置く（ポップオーバー用） */
  autoFocus?: boolean;
};

/** 最近開いたフォルダの一覧。フォルダ名・最後に開いたファイル・場所・いつ開いたかを並べる。 */
export function RecentFolderList({ entries, onSelect, autoFocus = false }: RecentFolderListProps) {
  const now = Date.now();
  return (
    <ul className="recent-folders">
      {entries.map((entry, i) => (
        <li key={entry.folder}>
          <button
            type="button"
            className="recent-folders__item"
            onClick={() => onSelect(entry)}
            title={entry.folder}
            // biome-ignore lint/a11y/noAutofocus: focus the first entry when the popover opens
            autoFocus={autoFocus && i === 0}
          >
            <FolderIcon size={14} />
            <span className="recent-folders__name">{entry.name}</span>
            <span className="recent-folders__when">{formatOpenedAt(entry.openedAt, now)}</span>
            <span className="recent-folders__file">{entry.fileName} を開いていました</span>
            <span className="recent-folders__location">{entry.location.join(" › ")}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
