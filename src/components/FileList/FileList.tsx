import { useEffect, useState } from "react";
import { readDirectoryFiles } from "../../api/directory";
import type { DirectoryEntry } from "../../types";
import { ArchiveIcon } from "../Icons/Icons";

interface FileListProps {
  folderPath: string | null;
  onArchiveSelect: (path: string) => void;
}

export function FileList({ folderPath, onArchiveSelect }: FileListProps) {
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folderPath) {
      setFiles([]);
      return;
    }

    const path = folderPath;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const entries = await readDirectoryFiles(path);
        if (!cancelled) {
          setFiles(entries);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [folderPath]);

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
        <p>No archives in this folder</p>
      </div>
    );
  }

  return (
    <div className="file-list">
      <div className="file-list__header">Archives</div>
      <div className="file-list__items">
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            className="file-list__item"
            onClick={() => onArchiveSelect(file.path)}
            title={file.path}
          >
            <ArchiveIcon size={14} />
            <span className="file-list__name">{file.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
