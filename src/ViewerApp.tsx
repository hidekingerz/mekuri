import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { getArchiveImage } from "./api/archive";
import { getSiblingFiles, moveFile, trashFile } from "./api/directory";
import { emitFileMoved, emitFileTrashed } from "./api/fileEvents";
import { recordRecentFolder } from "./api/recentFolders";
import { saveViewerSettings } from "./api/settings";
import { showViewerContextMenu } from "./api/viewerContextMenu";
import { SpreadViewer, type SpreadViewerHandle } from "./components/SpreadViewer/SpreadViewer";
import { ViewerNotice } from "./components/SpreadViewer/ViewerNotice";
import { SubfolderPanel } from "./components/SubfolderPanel/SubfolderPanel";
import { useArchiveLoader } from "./hooks/useArchiveLoader";
import { usePdfLoader } from "./hooks/usePdfLoader";
import { useSiblingNavigation } from "./hooks/useSiblingNavigation";
import { useTrashConfirm } from "./hooks/useTrashConfirm";
import { useWindowResize } from "./hooks/useWindowResize";
import { errorToString } from "./utils/errorToString";
import { detectFileType } from "./utils/fileType";
import { describeOpenError } from "./utils/openErrorMessage";
import type { ReadingDirection } from "./utils/spreadLayout";
import { currentEntry, siblingPath } from "./utils/spreadNavigation";
import { isMacUserAgent, isTrashShortcut } from "./utils/trashShortcut";
import { appTitle, fileNameFromPath } from "./utils/windowLabel";

function Viewer() {
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movePanelOpen, setMovePanelOpen] = useState(false);
  const [resumePage, setResumePage] = useState(0);
  const spreadViewerRef = useRef<SpreadViewerHandle>(null);
  const { confirm: confirmTrash, dialog: trashDialog } = useTrashConfirm();

  // Read archive path from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("archive");
    if (path) {
      setArchivePath(path);
    }
  }, []);

  // 開いたファイルのフォルダを「最近開いたフォルダ」に残す（前後の巻へ移ったときも更新）
  useEffect(() => {
    if (!archivePath) return;
    recordRecentFolder(archivePath).catch((err) => {
      console.error("Failed to record recent folder:", err);
    });
  }, [archivePath]);

  const fileType = archivePath ? detectFileType(archivePath) : "unknown";
  const isPdf = fileType === "pdf";

  const handleWindowResize = useCallback(async (size: { width: number; height: number }) => {
    await saveViewerSettings(size);
  }, []);
  useWindowResize(handleWindowResize);

  const navigateToArchive = useCallback((path: string) => {
    setResumePage(0);
    // 前のファイルでの失敗の表示は持ち越さない
    setTrashError(null);
    setMoveError(null);
    setArchivePath(path);
  }, []);

  const siblingNav = useSiblingNavigation(archivePath, navigateToArchive);

  // Native OS context menu with "Move to Trash"
  const archivePathRef = useRef(archivePath);
  archivePathRef.current = archivePath;

  // ゴミ箱へ移している最中かどうか（終わるまで、もう一度は受け付けない）
  const trashingRef = useRef(false);

  const handleTrash = useCallback(async () => {
    const currentPath = archivePathRef.current;
    if (!currentPath || trashingRef.current) return;

    const confirmed = await confirmTrash([currentPath]);
    if (!confirmed || trashingRef.current) return;

    trashingRef.current = true;
    setTrashError(null);
    try {
      // 消したあとに開くファイル（次、無ければ前）は、消す前の一覧で決める
      const { entries, sort } = await getSiblingFiles(currentPath);
      const current = currentEntry(entries, currentPath, null);
      const nextPath =
        siblingPath(entries, sort, current, "next") ?? siblingPath(entries, sort, current, "prev");

      await trashFile(currentPath);
      await emitFileTrashed();

      // 移しているあいだに利用者が別のファイルへ移っていたら、そのファイルを開いたままにする
      if (archivePathRef.current !== currentPath) return;

      if (nextPath) {
        navigateToArchive(nextPath);
        await getCurrentWindow().setTitle(appTitle(fileNameFromPath(nextPath)));
      } else {
        await getCurrentWindow().close();
      }
    } catch (err) {
      setTrashError(errorToString(err));
    } finally {
      trashingRef.current = false;
    }
  }, [navigateToArchive, confirmTrash]);

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
      if (!isTrashShortcut(e, isMacUserAgent(navigator.userAgent))) return;
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
      // 確認ダイアログが開いているあいだは、メニューから別の操作をさせない
      if (!archivePathRef.current || document.querySelector("dialog[open]")) return;
      void showViewerContextMenu(spreadViewerRef.current, siblingNav, () => void handleTrash());
    }

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [handleTrash, siblingNav]);

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

  const closeWindow = () => void getCurrentWindow().close();

  const showsNestedList =
    !isPdf && archive.nestedArchives !== null && archive.nestedArchives.length > 0;
  const showsPages =
    archivePath !== null && !error && !loading && !showsNestedList && pageCount > 0;

  // ページを表示していない画面（開けない・読み込み中・ネストの選択・空）では、タイトルにページ数を付けない
  useEffect(() => {
    if (!archivePath || showsPages) return;
    void getCurrentWindow().setTitle(appTitle(fileNameFromPath(archivePath)));
  }, [archivePath, showsPages]);

  // ゴミ箱の確認と、移動・ゴミ箱の失敗の表示。開けないファイルや空のファイルの画面でも
  // ゴミ箱へ移せるよう、どの画面にも置く
  const overlays = (
    <>
      {trashDialog}
      {moveError && (
        <div className="viewer__banner" role="alert">
          <span>ファイルを移動できませんでした: {moveError}</span>
          <button type="button" aria-label="閉じる" onClick={() => setMoveError(null)}>
            ×
          </button>
        </div>
      )}
      {trashError && (
        <div className="viewer__banner" role="alert">
          <span>ゴミ箱に移動できませんでした: {trashError}</span>
          <button type="button" aria-label="閉じる" onClick={() => setTrashError(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );

  if (error) {
    const described = describeOpenError(error, isPdf ? "pdf" : "archive");
    return (
      <div className="viewer">
        {overlays}
        <ViewerNotice
          tone="error"
          title={described.summary}
          detail={described.detail}
          siblingNav={siblingNav}
          onClose={closeWindow}
          onBack={!isPdf && archive.hasNestedCache ? handleBackToNestedList : undefined}
        />
      </div>
    );
  }

  if (!archivePath || loading) {
    return (
      <div className="viewer viewer--loading">
        {overlays}
        <p>読み込み中...</p>
      </div>
    );
  }

  // Show nested archive selection (archive mode only)
  if (showsNestedList && archive.nestedArchives) {
    return (
      <div className="viewer viewer--nested">
        {overlays}
        <div className="nested-selector">
          <h2 className="nested-selector__title">アーカイブを選択</h2>
          <p className="nested-selector__desc">
            このアーカイブには複数のアーカイブが含まれています:
          </p>
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

  if (pageCount === 0 || (!isPdf && archive.isEmpty)) {
    return (
      <div className="viewer">
        {overlays}
        <ViewerNotice
          tone="empty"
          title={isPdf ? "この PDF にはページがありません" : "このアーカイブには画像がありません"}
          siblingNav={siblingNav}
          onClose={closeWindow}
          onBack={!isPdf && archive.hasNestedCache ? handleBackToNestedList : undefined}
        />
      </div>
    );
  }

  return (
    <div className="viewer">
      {overlays}
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
        siblingNav={siblingNav}
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
