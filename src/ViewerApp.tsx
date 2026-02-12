import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { trashFile } from "./api/directory";
import { saveViewerSettings } from "./api/settings";
import { SpreadViewer } from "./components/SpreadViewer/SpreadViewer";
import { useArchiveLoader } from "./hooks/useArchiveLoader";
import { useSiblingNavigation } from "./hooks/useSiblingNavigation";
import { useWindowResize } from "./hooks/useWindowResize";
import { errorToString } from "./utils/errorToString";
import { fileNameFromPath } from "./utils/windowLabel";

type ViewerContextMenu = {
  x: number;
  y: number;
} | null;

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ViewerContextMenu>(null);

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

  // Window-level context menu
  useEffect(() => {
    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => setContextMenu(null);
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  const handleTrashFile = useCallback(async () => {
    if (!archivePath) return;
    setContextMenu(null);

    const confirmed = await ask(
      `Are you sure you want to move this file to the trash?\n\n${archivePath}`,
      { title: "Move to Trash", kind: "warning" },
    );
    if (!confirmed) return;

    try {
      await trashFile(archivePath);
      await getCurrentWindow().close();
    } catch (err) {
      setTrashError(errorToString(err));
    }
  }, [archivePath]);

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

  const contextMenuOverlay = contextMenu && archivePath && (
    <div
      className="context-menu viewer-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        type="button"
        className="context-menu__item context-menu__item--danger"
        onClick={handleTrashFile}
      >
        Move to Trash
      </button>
    </div>
  );

  if (error || trashError) {
    return (
      <div className="viewer viewer--error">
        <p>Failed to open archive</p>
        <p className="viewer__error-detail">{error || trashError}</p>
        {contextMenuOverlay}
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
        {contextMenuOverlay}
      </div>
    );
  }

  if (imageNames.length === 0) {
    return (
      <div className="viewer viewer--empty">
        <p>No images found in this archive</p>
        {contextMenuOverlay}
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
      {contextMenuOverlay}
    </div>
  );
}

export default Viewer;
