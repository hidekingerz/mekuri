import { useEffect, useState } from "react";
import { SpreadViewer } from "./components/SpreadViewer/SpreadViewer";
import { listArchiveImages } from "./hooks/useArchive";

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Read archive path from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("archive");
    if (path) {
      setArchivePath(path);
    }
  }, []);

  // Load image list when archive path is set
  useEffect(() => {
    if (!archivePath) return;
    const path = archivePath;

    let cancelled = false;

    async function load() {
      try {
        const names = await listArchiveImages(path);
        if (!cancelled) {
          setImageNames(names);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [archivePath]);

  if (error) {
    return (
      <div className="viewer viewer--error">
        <p>Failed to open archive</p>
        <p className="viewer__error-detail">{error}</p>
      </div>
    );
  }

  if (!archivePath || imageNames.length === 0) {
    return (
      <div className="viewer viewer--loading">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="viewer">
      <SpreadViewer archivePath={archivePath} imageNames={imageNames} />
    </div>
  );
}

export default Viewer;
