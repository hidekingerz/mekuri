import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { trashFile } from "./api/directory";
import { saveViewerSettings } from "./api/settings";
import { SpreadViewer } from "./components/SpreadViewer/SpreadViewer";
import { useArchiveLoader } from "./hooks/useArchiveLoader";
import { useSiblingNavigation } from "./hooks/useSiblingNavigation";
import { useWindowResize } from "./hooks/useWindowResize";
import { errorToString } from "./utils/errorToString";
import { fileNameFromPath } from "./utils/windowLabel";

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);

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

  // Native OS context menu with "Move to Trash"
  const archivePathRef = useRef(archivePath);
  archivePathRef.current = archivePath;

  useEffect(() => {
    async function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
      const currentPath = archivePathRef.current;
      if (!currentPath) return;

      const { Menu, MenuItem } = await import("@tauri-apps/api/menu");

      const trashItem = await MenuItem.new({
        text: "Move to Trash",
        action: async () => {
          const confirmed = await ask(
            `Are you sure you want to move this file to the trash?\n\n${currentPath}`,
            { title: "Move to Trash", kind: "warning" },
          );
          if (!confirmed) return;

          try {
            await trashFile(currentPath);
            const { emit } = await import("@tauri-apps/api/event");
            await emit("file-trashed");
            await getCurrentWindow().close();
          } catch (err) {
            setTrashError(errorToString(err));
          }
        },
      });

      const menu = await Menu.new({ items: [trashItem] });
      await menu.popup();
    }

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

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

  if (error || trashError) {
    return (
      <div className="viewer viewer--error">
        <p>Failed to open archive</p>
        <p className="viewer__error-detail">{error || trashError}</p>
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
