import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readDirectoryFiles, trashFiles } from "../../api/directory";
import { readDroppedPaths } from "../../api/fileDrop";
import { emitFileTrashed, onFileChanged } from "../../api/fileEvents";
import { useContextMenu } from "../../hooks/useContextMenu";
import { useFileSelection } from "../../hooks/useFileSelection";
import { useFolderDropTarget } from "../../hooks/useFolderDropTarget";
import { useTrashConfirm } from "../../hooks/useTrashConfirm";
import type { DirectoryEntry } from "../../types";
import { FILE_DRAG_MIME } from "../../utils/constants";
import { errorToString } from "../../utils/errorToString";
import { dragSource, encodeDragPaths } from "../../utils/fileDrag";
import {
  SORT_KEY_LABELS,
  type SortDirection,
  type SortKey,
  sortEntries,
} from "../../utils/fileSort";
import { isListKeySource, moveListIndex } from "../../utils/listKeyboard";
import type { ResolvedRecentFolder } from "../../utils/recentFolders";
import { isTrashShortcut } from "../../utils/trashShortcut";
import { ArchiveIcon, FolderIcon, PdfIcon } from "../Icons/Icons";
import { RecentFolderList } from "../RecentFolders/RecentFolderList";

type FileListProps = {
  folderPath: string | null;
  onArchiveSelect: (path: string) => void;
  /** Enter で選択中のファイルをまとめて開く（表示順） */
  onOpenFiles: (paths: string[]) => void;
  onFolderSelect: (path: string) => void;
  searchResults: DirectoryEntry[] | null;
  reloadTrigger?: number;
  /** Finder などから一覧へ落とされたファイルを、表示中のフォルダへ移す */
  onFileDrop?: (srcPaths: string[], destDir: string) => void;
  /** 最近開いたフォルダ（表示中のフォルダは除いたもの） */
  recentFolders?: ResolvedRecentFolder[];
  onRecentSelect?: (entry: ResolvedRecentFolder) => void;
  /** ゴミ箱への移動に失敗したときのメッセージ（始めるときは null で消す） */
  onTrashError?: (message: string | null) => void;
};

export function FileList({
  folderPath,
  onArchiveSelect,
  onOpenFiles,
  onFolderSelect,
  searchResults,
  reloadTrigger,
  onFileDrop,
  recentFolders = [],
  onRecentSelect,
  onTrashError,
}: FileListProps) {
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();
  const { selected, toggle, selectRange, selectOnly, clear, retain } = useFileSelection();
  const { confirm: confirmTrash, dialog: trashDialog } = useTrashConfirm();
  // キーボード操作の現在位置（最後にクリックまたは矢印で選んだ項目）
  const [cursorPath, setCursorPath] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const listRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const recentButtonRef = useRef<HTMLButtonElement>(null);
  const recentPopoverRef = useRef<HTMLDivElement>(null);

  // ポップオーバーの外を押したら閉じる。Esc はフォーカスがどこにあっても閉じて、ボタンへ戻す
  useEffect(() => {
    if (!recentOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (recentPopoverRef.current?.contains(target)) return;
      if (recentButtonRef.current?.contains(target)) return;
      setRecentOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setRecentOpen(false);
      recentButtonRef.current?.focus();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [recentOpen]);

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

  // フォルダを切り替えたとき・検索に入るか抜けるときは選択を解除する。
  // 同じ一覧の中身が変わっただけのときは、消えたファイルだけを下の retain で外す。
  const searching = searchResults !== null;
  const [prevList, setPrevList] = useState({ folderPath, searching });
  if (prevList.folderPath !== folderPath || prevList.searching !== searching) {
    setPrevList({ folderPath, searching });
    clear();
  }

  // 一覧から消えたファイル（別ウィンドウで消した・動かしたもの）を選択から外す
  const listedPaths = useMemo(
    () => (searchResults ?? files).filter((e) => !e.is_dir).map((e) => e.path),
    [searchResults, files],
  );
  useEffect(() => {
    retain(listedPaths);
  }, [listedPaths, retain]);

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

      onTrashError?.(null);
      try {
        await trashFiles(paths);
      } catch (err) {
        onTrashError?.(errorToString(err));
      } finally {
        clear();
        if (folderPath) await loadFiles(folderPath);
        await emitFileTrashed();
      }
    },
    [folderPath, loadFiles, clear, confirmTrash, onTrashError],
  );

  // Right-click on a selected item targets the whole selection; otherwise only that item
  const contextTargets =
    contextMenu && selected.has(contextMenu.path)
      ? [...selected]
      : contextMenu
        ? [contextMenu.path]
        : [];

  const focusItem = useCallback((path: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleTrashFromMenu = useCallback(() => {
    // メニューは消えるので、確認を閉じたあとキー操作が続けられるよう項目へフォーカスを戻しておく
    if (contextMenu) focusItem(contextMenu.path);
    closeContextMenu();
    trashPaths(contextTargets);
  }, [contextMenu, focusItem, closeContextMenu, trashPaths, contextTargets]);

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, order: string[]) => {
    if (!(e.target instanceof Element) || !isListKeySource(e.target, e.currentTarget)) return;
    if (e.key === "Escape") {
      clear();
      return;
    }
    if (isTrashShortcut(e) && selected.size > 0) {
      e.preventDefault();
      trashPaths([...selected]);
      return;
    }
    // Enter は選択中のファイルを一覧の並び順ですべて開く（選択から外した項目は開かない）。
    // 何も選んでいないときは既定の動作に任せ、フォーカスのある項目が選ばれる
    if (e.key === "Enter") {
      if (selected.size === 0) return;
      e.preventDefault();
      onOpenFiles(order.filter((path) => selected.has(path)));
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
        setCursorPath(file.path);
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

  const selectRecent = (entry: ResolvedRecentFolder) => {
    setRecentOpen(false);
    onRecentSelect?.(entry);
  };

  const showRecentButton = folderPath !== null && recentFolders.length > 0 && !!onRecentSelect;

  const renderRecentPopover = () =>
    recentOpen &&
    showRecentButton && (
      <div
        className="recent-popover"
        ref={recentPopoverRef}
        role="dialog"
        aria-label="最近開いたフォルダ"
      >
        <RecentFolderList entries={recentFolders} onSelect={selectRecent} autoFocus />
      </div>
    );

  const renderHeader = (label: string, count: number | null) => (
    <div className="file-list__header">
      <span className="file-list__header-title">
        {label}
        {count !== null && <span className="file-list__count">{count} 件</span>}
      </span>
      <span className="file-list__header-actions">
        {showRecentButton && (
          <button
            type="button"
            ref={recentButtonRef}
            className={`file-list__recent-btn${recentOpen ? " file-list__recent-btn--open" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={recentOpen}
            title="最近開いたフォルダ"
            onClick={() => setRecentOpen((v) => !v)}
          >
            最近
          </button>
        )}
        {renderSort(count)}
      </span>
    </div>
  );

  const renderSort = (count: number | null) =>
    count !== null &&
    count > 1 && (
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
    );

  // 検索結果のフォルダの行は、ファイルの落とし先にする（アプリ内のドラッグと Finder から）
  const { dragOverPath, dropProps: folderDropProps } = useFolderDropTarget(onFileDrop);

  // 検索結果表示モード
  if (searchResults !== null) {
    if (searchResults.length === 0) {
      return (
        <div className="file-list">
          {renderHeader("検索結果", 0)}
          {renderRecentPopover()}
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
        {renderRecentPopover()}
        <div
          className="file-list__items"
          role="listbox"
          aria-label="検索結果"
          aria-multiselectable="true"
        >
          {resultFolders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              className={`file-list__item${dragOverPath === folder.path ? " file-list__item--drop-target" : ""}`}
              role="option"
              aria-selected={false}
              onClick={() => onFolderSelect(folder.path)}
              {...folderDropProps(folder.path)}
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

  // 表示中のフォルダへの移動先として、アプリ外（Finder など）からのドラッグだけを受ける。
  // アプリ内のドラッグは一覧の項目そのものなので、同じフォルダへの移動にしかならない。
  const dropTarget = folderPath;
  const dropProps =
    dropTarget && onFileDrop
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (dragSource(e.dataTransfer.types) !== "external") return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setIsDragOver(true);
          },
          onDragLeave: (e: React.DragEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragOver(false);
          },
          onDrop: async (e: React.DragEvent) => {
            if (dragSource(e.dataTransfer.types) !== "external") return;
            e.preventDefault();
            setIsDragOver(false);
            const srcPaths = await readDroppedPaths(e.dataTransfer);
            if (srcPaths.length > 0) onFileDrop(srcPaths, dropTarget);
          },
        }
      : undefined;
  const listClassName = `file-list${isDragOver ? " file-list--drop-target" : ""}`;

  const renderMessage = (text: string, modifier: "empty" | "loading" | "error") => (
    <div className={listClassName} {...dropProps}>
      {renderHeader("ファイル", null)}
      {renderRecentPopover()}
      <div className={`file-list__message file-list__message--${modifier}`}>
        <p>{text}</p>
      </div>
    </div>
  );

  if (!folderPath) {
    if (recentFolders.length > 0 && onRecentSelect) {
      return (
        <div className="file-list">
          <div className="file-list__header">
            <span className="file-list__header-title">最近開いたフォルダ</span>
          </div>
          <div className="file-list__recent">
            <RecentFolderList entries={recentFolders} onSelect={onRecentSelect} />
            <p className="file-list__recent-hint">
              お気に入りやフォルダを選ぶと、ここにファイルの一覧が出ます
            </p>
          </div>
        </div>
      );
    }
    return renderMessage("フォルダを選んでください", "empty");
  }
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
      className={listClassName}
      ref={listRef}
      tabIndex={-1}
      onKeyDown={(e) => handleListKeyDown(e, order)}
      {...dropProps}
    >
      {renderHeader("ファイル", files.length)}
      {renderRecentPopover()}
      <div
        className="file-list__items"
        role="listbox"
        aria-label="ファイル"
        aria-multiselectable="true"
      >
        {sortedFiles.map((file) => renderFileItem(file, order))}
      </div>
      {renderContextMenu()}
      {trashDialog}
    </div>
  );
}
