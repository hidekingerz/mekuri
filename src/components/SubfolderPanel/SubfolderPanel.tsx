import { useEffect, useState } from "react";
import { getParentDirectory, readDirectoryFolders } from "../../api/directory";
import type { DirectoryEntry } from "../../types";
import { FILE_DRAG_MIME } from "../../utils/constants";
import { errorToString } from "../../utils/errorToString";
import { fileNameFromPath } from "../../utils/windowLabel";

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
  // 上の階層（閲覧中フォルダの親）。ルート到達時は getParentDirectory が
  // 同じパスを返すため、その場合はチップを出さない
  const grandParentDir = getParentDirectory(parentDir);
  const hasParentTarget = grandParentDir !== parentDir && grandParentDir !== "";

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

  const chipHandlers = (destDir: string) => ({
    onClick: () => onMove(destDir),
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(FILE_DRAG_MIME)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverPath(destDir);
      }
    },
    onDragLeave: () => setDragOverPath(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverPath(null);
      if (e.dataTransfer.getData(FILE_DRAG_MIME)) {
        onMove(destDir);
      }
    },
  });

  if (error) {
    return (
      <div className="subfolder-panel">
        <p className="subfolder-panel__empty">Failed to load subfolders: {error}</p>
      </div>
    );
  }

  return (
    <div className="subfolder-panel">
      {hasParentTarget && (
        <button
          type="button"
          className={`subfolder-panel__chip subfolder-panel__chip--parent${dragOverPath === grandParentDir ? " subfolder-panel__chip--drag-over" : ""}`}
          title={grandParentDir}
          {...chipHandlers(grandParentDir)}
        >
          ↑ {fileNameFromPath(grandParentDir)}
        </button>
      )}
      {folders.length === 0 && !hasParentTarget ? (
        <p className="subfolder-panel__empty">No subfolders in this folder</p>
      ) : (
        folders.map((folder) => (
          <button
            key={folder.path}
            type="button"
            className={`subfolder-panel__chip${dragOverPath === folder.path ? " subfolder-panel__chip--drag-over" : ""}`}
            title={folder.path}
            {...chipHandlers(folder.path)}
          >
            {folder.name}
          </button>
        ))
      )}
    </div>
  );
}
