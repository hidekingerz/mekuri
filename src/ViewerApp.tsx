import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { getArchiveImage } from "./api/archive";
import { getSiblingArchives, moveFile, trashFile } from "./api/directory";
import { emitFileMoved, emitFileTrashed } from "./api/fileEvents";
import { saveViewerSettings } from "./api/settings";
import { showViewerContextMenu } from "./api/viewerContextMenu";
import { SpreadViewer, type SpreadViewerHandle } from "./components/SpreadViewer/SpreadViewer";
import { SubfolderPanel } from "./components/SubfolderPanel/SubfolderPanel";
import { useArchiveLoader } from "./hooks/useArchiveLoader";
import { usePdfLoader } from "./hooks/usePdfLoader";
import { useSiblingNavigation } from "./hooks/useSiblingNavigation";
import { useWindowResize } from "./hooks/useWindowResize";
import { errorToString } from "./utils/errorToString";
import { detectFileType } from "./utils/fileType";
import type { ReadingDirection } from "./utils/spreadLayout";
import { siblingAfterRemoval } from "./utils/spreadNavigation";
import { trashConfirmMessage } from "./utils/trashConfirm";
import { appTitle, fileNameFromPath } from "./utils/windowLabel";

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movePanelOpen, setMovePanelOpen] = useState(false);
  const [resumePage, setResumePage] = useState(0);
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

  const navigateToArchive = useCallback((path: string) => {
    setResumePage(0);
    setArchivePath(path);
  }, []);

  useSiblingNavigation(archivePath, navigateToArchive);

  // Native OS context menu with "Move to Trash"
  const archivePathRef = useRef(archivePath);
  archivePathRef.current = archivePath;

  const handleTrash = useCallback(async () => {
    const currentPath = archivePathRef.current;
    if (!currentPath) return;

    const confirmed = await ask(trashConfirmMessage([currentPath]), {
      title: "Move to Trash",
      kind: "warning",
    });
    if (!confirmed) return;

    try {
      // Resolve next sibling before trashing so the deleted file is still listed.
      const { archives, currentIndex } = await getSiblingArchives(currentPath);
      const nextPath = siblingAfterRemoval(archives, currentIndex);

      await trashFile(currentPath);
      await emitFileTrashed();

      if (nextPath) {
        navigateToArchive(nextPath);
        await getCurrentWindow().setTitle(appTitle(fileNameFromPath(nextPath)));
      } else {
        await getCurrentWindow().close();
      }
    } catch (err) {
      setTrashError(errorToString(err));
    }
  }, [navigateToArchive]);

  const handleToggleMovePanel = useCallback(() => {
    setMovePanelOpen((v) => !v);
  }, []);

  const handleMoveTo = useCallback(async (destDir: string) => {
    const currentPath = archivePathRef.current;
    if (!currentPath) return;
    setMoveError(null);
    try {
      const newPath = await moveFile(currentPath, destDir);
      await emitFileMoved();
      // 新パスで再読込しても同じページ位置から再開する
      setResumePage(spreadViewerRef.current?.currentPage ?? 0);
      setMovePanelOpen(false);
      setArchivePath(newPath);
    } catch (err) {
      setMoveError(errorToString(err));
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
    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
      if (!archivePathRef.current) return;
      void showViewerContextMenu(spreadViewerRef.current, () => void handleTrash());
    }

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [handleTrash]);

  // Archive loader (only active for archive files)
  const archive = useArchiveLoader(isPdf ? null : archivePath);

  // Nested archive transitions remount SpreadViewer without changing archivePath,
  // so resumePage must be reset explicitly here (navigateToArchive doesn't run).
  const handleBackToNestedList = useCallback(() => {
    setResumePage(0);
    archive.backToNestedList();
  }, [archive]);

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
      getCurrentWindow().setTitle(appTitle(`${fileName} [${spreadIndex + 1}/${totalSpreads}]`));
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
                  onClick={() => {
                    setResumePage(0);
                    archive.selectNestedArchive(name);
                  }}
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

  // Moving the outer archive of a nested container remounts through the nested
  // selector, dropping page position and selection — disable move in that flow.
  const canMoveFile = isPdf || !archive.hasNestedCache;

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
      {moveError && (
        <div className="viewer__move-error" role="alert">
          <span>Failed to move file: {moveError}</span>
          <button type="button" onClick={() => setMoveError(null)}>
            ×
          </button>
        </div>
      )}
      <SpreadViewer
        key={archivePath}
        ref={spreadViewerRef}
        pageCount={pageCount}
        pageNames={pageNames}
        getPageDataUrl={getPageDataUrl}
        onSpreadChange={handleSpreadChange}
        onBack={!isPdf && archive.hasNestedCache ? handleBackToNestedList : undefined}
        defaultReadingDirection={defaultReadingDirection}
        initialPage={resumePage}
        movePanel={
          canMoveFile
            ? {
                open: movePanelOpen,
                onToggle: handleToggleMovePanel,
                dragData: archivePath,
              }
            : undefined
        }
      />
      {movePanelOpen && canMoveFile && (
        <SubfolderPanel archivePath={archivePath} onMove={handleMoveTo} />
      )}
    </div>
  );
}

export default Viewer;
