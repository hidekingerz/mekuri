import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { readDirectoryFiles, trashFile } from "../../api/directory";
import { useContextMenu } from "../../hooks/useContextMenu";
import type { DirectoryEntry } from "../../types";
import { errorToString } from "../../utils/errorToString";
import { ArchiveIcon, PdfIcon } from "../Icons/Icons";

type FileListProps = {
  folderPath: string | null;
  onArchiveSelect: (path: string) => void;
};

export function FileList({ folderPath, onArchiveSelect }: FileListProps) {
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const entries = await readDirectoryFiles(path);
      setFiles(entries);
    } catch (err) {
      setError(errorToString(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!folderPath) {
      setFiles([]);
      return;
    }

    const path = folderPath;
    let cancelled = false;

    async function load() {
      try {
        const entries = await readDirectoryFiles(path);
        if (!cancelled) {
          setFiles(entries);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorToString(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setError(null);
    load();
    return () => {
      cancelled = true;
    };
  }, [folderPath]);

  // Reload file list when a file is trashed from the viewer window
  useEffect(() => {
    if (!folderPath) return;
    const path = folderPath;
    const unlisten = listen("file-trashed", () => {
      loadFiles(path);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [folderPath, loadFiles]);

  const handleTrashFile = useCallback(async () => {
    if (!contextMenu || !folderPath) return;
    const filePath = contextMenu.path;
    closeContextMenu();

    const confirmed = await ask(
      `Are you sure you want to move this file to the trash?\n\n${filePath}`,
      { title: "Move to Trash", kind: "warning" },
    );
    if (!confirmed) return;

    try {
      await trashFile(filePath);
      await loadFiles(folderPath);
    } catch (err) {
      setError(errorToString(err));
    }
  }, [contextMenu, folderPath, closeContextMenu, loadFiles]);

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

  return (
    <div className="file-list">
      <div className="file-list__header">Files</div>
      <div className="file-list__items">
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            className="file-list__item"
            onClick={() => onArchiveSelect(file.path)}
            onContextMenu={(e) => openContextMenu(e, file.path)}
            title={file.path}
          >
            {file.is_pdf ? <PdfIcon size={14} /> : <ArchiveIcon size={14} />}
            <span className="file-list__name">{file.name}</span>
          </button>
        ))}
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            type="button"
            className="context-menu__item context-menu__item--danger"
            onClick={handleTrashFile}
          >
            Move to Trash
          </button>
        </div>
      )}
    </div>
  );
}
