import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { saveViewerSettings } from "./api/settings";
import { SpreadViewer } from "./components/SpreadViewer/SpreadViewer";
import { useArchiveLoader } from "./hooks/useArchiveLoader";
import { useSiblingNavigation } from "./hooks/useSiblingNavigation";
import { useWindowResize } from "./hooks/useWindowResize";
import { fileNameFromPath } from "./utils/windowLabel";

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);

  // Read archive path from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("archive");
    if (path) {
      setArchivePath(path);
    }
  }, []);

  const handleWindowResize = useCallback(async (size: { width: number; height: number }) => {
    await saveViewerSettings(size);
  }, []);
  useWindowResize(handleWindowResize);

  useSiblingNavigation(archivePath, setArchivePath);

  const {
    effectivePath,
    imageNames,
    nestedArchives,
    loading,
    error,
    hasNestedCache,
    selectNestedArchive,
    backToNestedList,
  } = useArchiveLoader(archivePath);

  const handleSpreadChange = useCallback(
    (spreadIndex: number, totalSpreads: number) => {
      if (!archivePath) return;
      const fileName = fileNameFromPath(archivePath);
      const title = `${fileName} [${spreadIndex + 1}/${totalSpreads}] - mekuri`;
      getCurrentWindow().setTitle(title);
    },
    [archivePath],
  );

  if (error) {
    return (
      <div className="viewer viewer--error">
        <p>Failed to open archive</p>
        <p className="viewer__error-detail">{error}</p>
      </div>
    );
  }

  if (!archivePath || loading) {
    return (
      <div className="viewer viewer--loading">
        <p>Loading...</p>
      </div>
    );
  }

  // Show nested archive selection
  if (nestedArchives && nestedArchives.length > 0) {
    return (
      <div className="viewer viewer--nested">
        <div className="nested-selector">
          <h2 className="nested-selector__title">Select Archive</h2>
          <p className="nested-selector__desc">This archive contains multiple archives:</p>
          <ul className="nested-selector__list">
            {nestedArchives.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className="nested-selector__item"
                  onClick={() => selectNestedArchive(name)}
                >
                  {name.split("/").pop() || name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (imageNames.length === 0) {
    return (
      <div className="viewer viewer--empty">
        <p>No images found in this archive</p>
      </div>
    );
  }

  return (
    <div className="viewer">
      <SpreadViewer
        archivePath={effectivePath || archivePath}
        imageNames={imageNames}
        onSpreadChange={handleSpreadChange}
        onBack={hasNestedCache ? backToNestedList : undefined}
      />
    </div>
  );
}

export default Viewer;
