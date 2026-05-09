import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { getArchiveImage } from "./api/archive";
import { getSiblingArchives, trashFile } from "./api/directory";
import { saveViewerSettings } from "./api/settings";
import { SpreadViewer, type SpreadViewerHandle } from "./components/SpreadViewer/SpreadViewer";
import { useArchiveLoader } from "./hooks/useArchiveLoader";
import { usePdfLoader } from "./hooks/usePdfLoader";
import { useSiblingNavigation } from "./hooks/useSiblingNavigation";
import { useWindowResize } from "./hooks/useWindowResize";
import { errorToString } from "./utils/errorToString";
import { detectFileType } from "./utils/fileType";
import type { ReadingDirection } from "./utils/spreadLayout";
import { fileNameFromPath } from "./utils/windowLabel";

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const spreadViewerRef = useRef<SpreadViewerHandle>(null);

  // Read archive path from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("archive");
    if (path) {
      setArchivePath(path);
    }
  }, []);

  const fileType = archivePath ? detectFileType(archivePath) : "unknown";
  const isPdf = fileType === "pdf";

  const handleWindowResize = useCallback(async (size: { width: number; height: number }) => {
    await saveViewerSettings(size);
  }, []);
  useWindowResize(handleWindowResize);

  useSiblingNavigation(archivePath, setArchivePath);

  // Native OS context menu with "Move to Trash"
  const archivePathRef = useRef(archivePath);
  archivePathRef.current = archivePath;

  const handleTrash = useCallback(async () => {
    const currentPath = archivePathRef.current;
    if (!currentPath) return;

    const confirmed = await ask(
      `Are you sure you want to move this file to the trash?\n\n${currentPath}`,
      { title: "Move to Trash", kind: "warning" },
    );
    if (!confirmed) return;

    try {
      // Resolve next sibling before trashing so the deleted file is still listed.
      const { archives, currentIndex } = await getSiblingArchives(currentPath);
      const nextPath =
        currentIndex >= 0
          ? (archives[currentIndex + 1] ?? archives[currentIndex - 1] ?? null)
          : null;

      await trashFile(currentPath);
      const { emit } = await import("@tauri-apps/api/event");
      await emit("file-trashed");

      if (nextPath) {
        setArchivePath(nextPath);
        await getCurrentWindow().setTitle(`${fileNameFromPath(nextPath)} - mekuri`);
      } else {
        await getCurrentWindow().close();
      }
    } catch (err) {
      setTrashError(errorToString(err));
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // macOS keyboards send "Backspace" for the main Delete key;
      // "Delete" is fn+Delete (forward delete) on Mac and Del on other platforms.
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      void handleTrash();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTrash]);

  useEffect(() => {
    async function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
      const currentPath = archivePathRef.current;
      if (!currentPath) return;

      const { Menu, MenuItem, PredefinedMenuItem } = await import("@tauri-apps/api/menu");
      const handle = spreadViewerRef.current;

      const viewModeItem = await MenuItem.new({
        text: handle?.viewMode === "single" ? "見開き表示" : "単ページ表示",
        action: () => handle?.toggleViewMode(),
      });

      const directionItem = await MenuItem.new({
        text: handle?.readingDirection === "rtl" ? "左→右 (LTR) に切替" : "右→左 (RTL) に切替",
        action: () => handle?.toggleReadingDirection(),
      });

      const separator1 = await PredefinedMenuItem.new({ item: "Separator" });
      const separator2 = await PredefinedMenuItem.new({ item: "Separator" });

      const trashItem = await MenuItem.new({
        text: "Move to Trash",
        action: handleTrash,
      });

      const closeItem = await MenuItem.new({
        text: "Close Window",
        action: () => getCurrentWindow().close(),
      });

      const menu = await Menu.new({
        items: [viewModeItem, directionItem, separator1, trashItem, separator2, closeItem],
      });
      await menu.popup();
    }

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [handleTrash]);

  // Archive loader (only active for archive files)
  const archive = useArchiveLoader(isPdf ? null : archivePath);

  // PDF loader (only active for PDF files)
  const pdf = usePdfLoader(isPdf ? archivePath : null);

  // Build a unified getPageDataUrl callback for archive mode
  const archiveEffectivePath = archive.effectivePath || archivePath;
  const archiveImageNames = archive.imageNames;
  const getArchivePageDataUrl = useCallback(
    async (pageIndex: number): Promise<string> => {
      if (!archiveEffectivePath) throw new Error("No archive path");
      return getArchiveImage(archiveEffectivePath, archiveImageNames[pageIndex]);
    },
    [archiveEffectivePath, archiveImageNames],
  );

  // Unified props
  const pageCount = isPdf ? pdf.pageCount : archive.imageNames.length;
  const pageNames = isPdf ? pdf.pageNames : archive.imageNames;
  const getPageDataUrl = isPdf ? pdf.getPageDataUrl : getArchivePageDataUrl;
  const loading = isPdf ? pdf.loading : archive.loading;
  const error = isPdf ? pdf.error : archive.error;

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
        <p>Failed to open {isPdf ? "PDF" : "archive"}</p>
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

  // Show nested archive selection (archive mode only)
  if (!isPdf && archive.nestedArchives && archive.nestedArchives.length > 0) {
    return (
      <div className="viewer viewer--nested">
        <div className="nested-selector">
          <h2 className="nested-selector__title">Select Archive</h2>
          <p className="nested-selector__desc">This archive contains multiple archives:</p>
          <ul className="nested-selector__list">
            {archive.nestedArchives.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className="nested-selector__item"
                  onClick={() => archive.selectNestedArchive(name)}
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

  const defaultReadingDirection: ReadingDirection = isPdf ? "ltr" : "rtl";

  if (pageCount === 0) {
    return (
      <div className="viewer viewer--empty">
        <p>
          No {isPdf ? "pages" : "images"} found in this {isPdf ? "PDF" : "archive"}
        </p>
      </div>
    );
  }

  return (
    <div className="viewer">
      <SpreadViewer
        ref={spreadViewerRef}
        pageCount={pageCount}
        pageNames={pageNames}
        getPageDataUrl={getPageDataUrl}
        onSpreadChange={handleSpreadChange}
        onBack={!isPdf && archive.hasNestedCache ? archive.backToNestedList : undefined}
        defaultReadingDirection={defaultReadingDirection}
      />
    </div>
  );
}

export default Viewer;
