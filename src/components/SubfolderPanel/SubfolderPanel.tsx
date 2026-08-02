import { useEffect, useState } from "react";
import { getParentDirectory, readDirectoryFolders } from "../../api/directory";
import type { DirectoryEntry } from "../../types";
import { FILE_DRAG_MIME } from "../../utils/constants";
import { errorToString } from "../../utils/errorToString";

type SubfolderPanelProps = {
  /** 閲覧中ファイルのパス。この親フォルダ直下のサブフォルダを移動先候補にする */
  archivePath: string;
  onMove: (destDir: string) => void;
};

export function SubfolderPanel({ archivePath, onMove }: SubfolderPanelProps) {
  const [folders, setFolders] = useState<DirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const parentDir = getParentDirectory(archivePath);

  useEffect(() => {
    let cancelled = false;
    readDirectoryFolders(parentDir)
      .then((entries) => {
        if (!cancelled) setFolders(entries);
      })
      .catch((err) => {
        if (!cancelled) setError(errorToString(err));
      });
    return () => {
      cancelled = true;
    };
  }, [parentDir]);

  return (
    <div className="subfolder-panel">
      {error ? (
        <p className="subfolder-panel__empty">Failed to load subfolders: {error}</p>
      ) : folders.length === 0 ? (
        <p className="subfolder-panel__empty">No subfolders in this folder</p>
      ) : (
        folders.map((folder) => (
          <button
            key={folder.path}
            type="button"
            className={`subfolder-panel__chip${dragOverPath === folder.path ? " subfolder-panel__chip--drag-over" : ""}`}
            title={folder.path}
            onClick={() => onMove(folder.path)}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(FILE_DRAG_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverPath(folder.path);
              }
            }}
            onDragLeave={() => setDragOverPath(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverPath(null);
              if (e.dataTransfer.getData(FILE_DRAG_MIME)) {
                onMove(folder.path);
              }
            }}
          >
            {folder.name}
          </button>
        ))
      )}
    </div>
  );
}
