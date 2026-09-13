import { emit, listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { readDirectoryFiles, trashFiles } from "../../api/directory";
import { useContextMenu } from "../../hooks/useContextMenu";
import { useFileSelection } from "../../hooks/useFileSelection";
import type { DirectoryEntry } from "../../types";
import { FILE_DRAG_MIME } from "../../utils/constants";
import { errorToString } from "../../utils/errorToString";
import { encodeDragPaths } from "../../utils/fileDrag";
import { ArchiveIcon, FolderIcon, PdfIcon } from "../Icons/Icons";

type FileListProps = {
  folderPath: string | null;
  onArchiveSelect: (path: string) => void;
  onFolderSelect: (path: string) => void;
  searchResults: DirectoryEntry[] | null;
  reloadTrigger?: number;
};

const CONFIRM_PREVIEW_COUNT = 5;

function confirmMessage(paths: string[]): string {
  if (paths.length === 1) {
    return `Are you sure you want to move this file to the trash?\n\n${paths[0]}`;
  }
  const preview = paths.slice(0, CONFIRM_PREVIEW_COUNT).join("\n");
  const rest = paths.length - CONFIRM_PREVIEW_COUNT;
  const suffix = rest > 0 ? `\n…and ${rest} more` : "";
  return `Are you sure you want to move ${paths.length} files to the trash?\n\n${preview}${suffix}`;
}

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
    const unlistenTrash = listen("file-trashed", () => {
      loadFiles(path);
    });
    const unlistenMove = listen("file-moved", () => {
      loadFiles(path);
    });
    return () => {
      unlistenTrash.then((fn) => fn());
      unlistenMove.then((fn) => fn());
    };
  }, [folderPath, loadFiles]);

  const trashPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      const confirmed = await ask(confirmMessage(paths), {
        title: "Move to Trash",
        kind: "warning",
      });
      if (!confirmed) return;

      try {
        await trashFiles(paths);
      } catch (err) {
        setError(errorToString(err));
      } finally {
        clear();
        if (folderPath) await loadFiles(folderPath);
        await emit("file-trashed");
      }
    },
    [folderPath, loadFiles, clear],
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        clear();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        trashPaths([...selected]);
      }
    },
    [clear, selected, trashPaths],
  );

  // Finder-style: single click selects (and anchors a range), double click opens
  const handleItemClick = (e: React.MouseEvent, file: DirectoryEntry, order: string[]) => {
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
      onClick={(e) => handleItemClick(e, file, order)}
      onDoubleClick={() => onArchiveSelect(file.path)}
      onContextMenu={(e) => openContextMenu(e, file.path)}
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
          {contextTargets.length > 1
            ? `Move ${contextTargets.length} files to Trash`
            : "Move to Trash"}
        </button>
      </div>
    );

  // 検索結果表示モード
  if (searchResults !== null) {
    if (searchResults.length === 0) {
      return (
        <div className="file-list file-list--empty">
          <p>No matches found</p>
        </div>
      );
    }

    const resultFolders = searchResults.filter((e) => e.is_dir);
    const resultFiles = searchResults.filter((e) => !e.is_dir);
    const order = resultFiles.map((f) => f.path);

    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the list container
      <div className="file-list" tabIndex={-1} onKeyDown={handleKeyDown}>
        <div className="file-list__header">Search Results</div>
        <div className="file-list__items">
          {resultFolders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              className="file-list__item"
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
      </div>
    );
  }

  if (!folderPath) {
    return (
      <div className="file-list file-list--empty">
        <p>Select a folder</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="file-list file-list--loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-list file-list--error">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="file-list file-list--empty">
        <p>No archives or PDFs in this folder</p>
      </div>
    );
  }

  const order = files.map((f) => f.path);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the list container
    <div className="file-list" tabIndex={-1} onKeyDown={handleKeyDown}>
      <div className="file-list__header">Files</div>
      <div className="file-list__items">{files.map((file) => renderFileItem(file, order))}</div>
      {renderContextMenu()}
    </div>
  );
}
