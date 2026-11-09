import { useCallback, useEffect, useRef, useState } from "react";
import { readDirectoryFiles, trashFiles } from "../../api/directory";
import { emitFileTrashed, onFileChanged } from "../../api/fileEvents";
import { useContextMenu } from "../../hooks/useContextMenu";
import { useFileSelection } from "../../hooks/useFileSelection";
import { useTrashConfirm } from "../../hooks/useTrashConfirm";
import type { DirectoryEntry } from "../../types";
import { FILE_DRAG_MIME } from "../../utils/constants";
import { errorToString } from "../../utils/errorToString";
import { encodeDragPaths } from "../../utils/fileDrag";
import {
  SORT_KEY_LABELS,
  type SortDirection,
  type SortKey,
  sortEntries,
} from "../../utils/fileSort";
import { moveListIndex } from "../../utils/listKeyboard";
import { isTrashShortcut } from "../../utils/trashShortcut";
import { ArchiveIcon, FolderIcon, PdfIcon } from "../Icons/Icons";

type FileListProps = {
  folderPath: string | null;
  onArchiveSelect: (path: string) => void;
  onFolderSelect: (path: string) => void;
  searchResults: DirectoryEntry[] | null;
  reloadTrigger?: number;
};

export function FileList({
  folderPath,
  onArchiveSelect,
  onFolderSelect,
  searchResults,
  reloadTrigger,
}: FileListProps) {
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();
  const { selected, toggle, selectRange, selectOnly, clear } = useFileSelection();
  const { confirm: confirmTrash, dialog: trashDialog } = useTrashConfirm();
  // キーボード操作の現在位置（最後にクリックまたは矢印で選んだ項目）
  const [cursorPath, setCursorPath] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const listRef = useRef<HTMLDivElement>(null);

  // 古い応答を捨てるためのリクエスト連番。フォルダ切替や再読込のたびに進める。
  const requestIdRef = useRef(0);

  const loadFiles = useCallback(async (path: string) => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const entries = await readDirectoryFiles(path);
      if (isCurrent()) setFiles(entries);
    } catch (err) {
      if (isCurrent()) setError(errorToString(err));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadTrigger is intentionally used to force re-fetch
  useEffect(() => {
    if (!folderPath) {
      requestIdRef.current++;
      setFiles([]);
      setLoading(false);
      return;
    }
    void loadFiles(folderPath);
  }, [folderPath, reloadTrigger, loadFiles]);

  // Clear selection whenever the displayed list changes
  const [prevList, setPrevList] = useState({ folderPath, searchResults });
  if (prevList.folderPath !== folderPath || prevList.searchResults !== searchResults) {
    setPrevList({ folderPath, searchResults });
    clear();
  }

  // Reload file list when a file is trashed or moved from another surface
  useEffect(() => {
    if (!folderPath) return;
    const path = folderPath;
    const unlisten = onFileChanged(() => {
      loadFiles(path);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [folderPath, loadFiles]);

  const trashPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      const confirmed = await confirmTrash(paths);
      if (!confirmed) return;

      try {
        await trashFiles(paths);
      } catch (err) {
        setError(errorToString(err));
      } finally {
        clear();
        if (folderPath) await loadFiles(folderPath);
        await emitFileTrashed();
      }
    },
    [folderPath, loadFiles, clear, confirmTrash],
  );

  // Right-click on a selected item targets the whole selection; otherwise only that item
  const contextTargets =
    contextMenu && selected.has(contextMenu.path)
      ? [...selected]
      : contextMenu
        ? [contextMenu.path]
        : [];

  const handleTrashFromMenu = useCallback(() => {
    closeContextMenu();
    trashPaths(contextTargets);
  }, [closeContextMenu, trashPaths, contextTargets]);

  const focusItem = useCallback((path: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, order: string[]) => {
    if (e.key === "Escape") {
      clear();
      return;
    }
    if (isTrashShortcut(e) && selected.size > 0) {
      e.preventDefault();
      trashPaths([...selected]);
      return;
    }
    if (e.key === "Enter" && cursorPath && order.includes(cursorPath)) {
      e.preventDefault();
      onArchiveSelect(cursorPath);
      return;
    }
    const nextIndex = moveListIndex(order.length, order.indexOf(cursorPath ?? ""), e.key);
    if (nextIndex === null) return;
    e.preventDefault();
    const nextPath = order[nextIndex];
    if (e.shiftKey) selectRange(order, nextPath);
    else selectOnly(nextPath);
    setCursorPath(nextPath);
    focusItem(nextPath);
  };

  // Finder-style: single click selects (and anchors a range), double click opens
  const handleItemClick = (e: React.MouseEvent, file: DirectoryEntry, order: string[]) => {
    setCursorPath(file.path);
    if (e.shiftKey) {
      e.preventDefault();
      selectRange(order, file.path);
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggle(file.path);
    } else {
      selectOnly(file.path);
    }
  };

  const renderFileItem = (file: DirectoryEntry, order: string[]) => (
    <button
      key={file.path}
      type="button"
      className={`file-list__item${selected.has(file.path) ? " file-list__item--selected" : ""}`}
      role="option"
      aria-selected={selected.has(file.path)}
      data-path={file.path}
      onClick={(e) => handleItemClick(e, file, order)}
      onDoubleClick={() => onArchiveSelect(file.path)}
      onContextMenu={(e) => {
        if (!selected.has(file.path)) selectOnly(file.path);
        openContextMenu(e, file.path);
      }}
      title={file.path}
      draggable
      onDragStart={(e) => {
        // Dragging a selected item carries the whole selection; otherwise only that item
        const paths = selected.has(file.path) ? [...selected] : [file.path];
        e.dataTransfer.setData(FILE_DRAG_MIME, encodeDragPaths(paths));
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      {file.is_pdf ? <PdfIcon size={14} /> : <ArchiveIcon size={14} />}
      <span className="file-list__name">{file.name}</span>
    </button>
  );

  const renderContextMenu = () =>
    contextMenu && (
      <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <button
          type="button"
          className="context-menu__item context-menu__item--danger"
          onClick={handleTrashFromMenu}
        >
          {contextTargets.length > 1 ? `${contextTargets.length} 件をゴミ箱に移動` : "ゴミ箱に移動"}
        </button>
      </div>
    );

  const renderHeader = (label: string, count: number | null) => (
    <div className="file-list__header">
      <span className="file-list__header-title">
        {label}
        {count !== null && <span className="file-list__count">{count} 件</span>}
      </span>
      {count !== null && count > 1 && (
        <span className="file-list__sort">
          <select
            className="file-list__sort-select"
            aria-label="並び順"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {(Object.keys(SORT_KEY_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_KEY_LABELS[key]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="file-list__sort-dir"
            aria-label={sortDirection === "asc" ? "昇順。クリックで降順" : "降順。クリックで昇順"}
            title={sortDirection === "asc" ? "昇順" : "降順"}
            onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </button>
        </span>
      )}
    </div>
  );

  // 検索結果表示モード
  if (searchResults !== null) {
    if (searchResults.length === 0) {
      return (
        <div className="file-list">
          {renderHeader("検索結果", 0)}
          <div className="file-list__message file-list__message--empty">
            <p>一致するものがありません</p>
          </div>
        </div>
      );
    }

    const resultFolders = searchResults.filter((e) => e.is_dir);
    const resultFiles = sortEntries(
      searchResults.filter((e) => !e.is_dir),
      sortKey,
      sortDirection,
    );
    const order = resultFiles.map((f) => f.path);

    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the list container
      <div
        className="file-list"
        ref={listRef}
        tabIndex={-1}
        onKeyDown={(e) => handleListKeyDown(e, order)}
      >
        {renderHeader("検索結果", searchResults.length)}
        <div className="file-list__items" role="listbox" aria-multiselectable="true">
          {resultFolders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              className="file-list__item"
              role="option"
              aria-selected={false}
              onClick={() => onFolderSelect(folder.path)}
              title={folder.path}
            >
              <FolderIcon size={14} />
              <span className="file-list__name">{folder.name}</span>
            </button>
          ))}
          {resultFiles.map((file) => renderFileItem(file, order))}
        </div>
        {renderContextMenu()}
        {trashDialog}
      </div>
    );
  }

  const renderMessage = (text: string, modifier: "empty" | "loading" | "error") => (
    <div className="file-list">
      {renderHeader("ファイル", null)}
      <div className={`file-list__message file-list__message--${modifier}`}>
        <p>{text}</p>
      </div>
    </div>
  );

  if (!folderPath) return renderMessage("フォルダを選んでください", "empty");
  if (loading) return renderMessage("読み込み中...", "loading");
  if (error) return renderMessage(`読み込めませんでした: ${error}`, "error");
  if (files.length === 0) {
    return renderMessage("このフォルダにアーカイブや PDF はありません", "empty");
  }

  const sortedFiles = sortEntries(files, sortKey, sortDirection);
  const order = sortedFiles.map((f) => f.path);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the list container
    <div
      className="file-list"
      ref={listRef}
      tabIndex={-1}
      onKeyDown={(e) => handleListKeyDown(e, order)}
    >
      {renderHeader("ファイル", files.length)}
      <div className="file-list__items" role="listbox" aria-multiselectable="true">
        {sortedFiles.map((file) => renderFileItem(file, order))}
      </div>
      {renderContextMenu()}
      {trashDialog}
    </div>
  );
}
