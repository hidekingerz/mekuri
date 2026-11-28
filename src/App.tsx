import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { countFiles, moveFiles, trashFolder } from "./api/directory";
import { addFavorite, getFavorites, removeFavorites } from "./api/favorites";
import { emitFileMoved, emitFileTrashed, onFileChanged } from "./api/fileEvents";
import { openViewerWindow, openViewerWindows } from "./api/viewerWindow";
import { FavoritesSidebar } from "./components/FavoritesSidebar/FavoritesSidebar";
import { FileList } from "./components/FileList/FileList";
import { FolderTree } from "./components/FolderTree/FolderTree";
import { UpdateBanner } from "./components/UpdateBanner/UpdateBanner";
import { useColumnResize } from "./hooks/useColumnResize";
import { useConfirmDialog } from "./hooks/useConfirmDialog";
import { useFolderSearch } from "./hooks/useFolderSearch";
import { useMainWindowSetup } from "./hooks/useMainWindowSetup";
import { useRecentFolders } from "./hooks/useRecentFolders";
import { useUpdater } from "./hooks/useUpdater";
import { DEFAULT_TREE_COLUMN_WIDTH } from "./utils/constants";
import { errorToString } from "./utils/errorToString";
import { favoritesInside } from "./utils/favorites";
import { selectionAfterRemoval } from "./utils/folderTree";
import type { ResolvedRecentFolder } from "./utils/recentFolders";
import { folderTrashConfirmLines, folderTrashConfirmTitle } from "./utils/trashConfirm";
import { appTitle, fileNameFromPath } from "./utils/windowLabel";

function App() {
  const [selectedFavorite, setSelectedFavorite] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [favoritesRefresh, setFavoritesRefresh] = useState(0);
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const columnsRef = useRef<HTMLDivElement>(null);
  const { treeColumnWidth, setWidth, isResizing, startResize } = useColumnResize(
    DEFAULT_TREE_COLUMN_WIDTH,
    columnsRef,
  );
  useMainWindowSetup(setWidth);
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    folders: searchFolders,
    error: searchError,
    isActive: searchActive,
    rerun: rerunSearch,
    clear: clearSearch,
  } = useFolderSearch(selectedFavorite);
  const updater = useUpdater();
  const updaterBusy =
    updater.state.status === "checking" ||
    updater.state.status === "downloading" ||
    updater.state.status === "ready";

  // Update main window title
  useEffect(() => {
    getCurrentWindow().setTitle(appTitle(selectedFavorite && fileNameFromPath(selectedFavorite)));
  }, [selectedFavorite]);

  const handleAddFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (!selected) return;
    setFavoriteError(null);
    try {
      await addFavorite(selected);
    } catch (err) {
      setFavoriteError(errorToString(err));
      return;
    }
    setFavoritesRefresh((n) => n + 1);
    setSelectedFavorite(selected);
    setSelectedFolder(null);
  }, []);

  const handleReload = useCallback(() => {
    if (searchActive) {
      void rerunSearch();
      return;
    }
    setReloadTrigger((n) => n + 1);
  }, [searchActive, rerunSearch]);

  // ファイルが消えた・動いたら、表示中の検索結果も取り直す（消えた項目を残さない）
  useEffect(() => {
    const unlisten = onFileChanged(() => {
      void rerunSearch();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [rerunSearch]);

  const handleFavoriteSelect = useCallback((path: string) => {
    setSelectedFavorite(path);
    setSelectedFolder(null);
  }, []);

  const handleFolderSelect = useCallback(
    (path: string) => {
      setSelectedFolder(path);
      if (searchResults !== null) {
        setRevealPath(path);
      }
      clearSearch();
    },
    [searchResults, clearSearch],
  );

  const shownFolder = selectedFolder || selectedFavorite;
  const recentFolders = useRecentFolders(favoritesRefresh, shownFolder);

  // 履歴から選んだフォルダへ移る。お気に入りを切り替え、ツリーをそこまで開く
  const handleRecentSelect = useCallback(
    (entry: ResolvedRecentFolder) => {
      clearSearch();
      setSelectedFavorite(entry.favorite);
      const isRoot = entry.folder === entry.favorite;
      setSelectedFolder(isRoot ? null : entry.folder);
      setRevealPath(isRoot ? null : entry.folder);
    },
    [clearSearch],
  );

  const handleRevealComplete = useCallback(() => {
    setRevealPath(null);
  }, []);

  const handleFavoriteAdded = useCallback(() => {
    setFavoritesRefresh((n) => n + 1);
  }, []);

  // 表示中のお気に入りを外したら、そのツリーと一覧も閉じる（外したのに中身だけ残さない）
  const handleFavoriteRemoved = useCallback((path: string) => {
    setFavoritesRefresh((n) => n + 1);
    setSelectedFavorite((current) => {
      if (current !== path) return current;
      setSelectedFolder(null);
      setRevealPath(null);
      return null;
    });
  }, []);

  const handleFileDrop = useCallback(async (srcPaths: string[], destDir: string) => {
    setMoveError(null);
    const { moved, errors } = await moveFiles(srcPaths, destDir);
    if (errors.length > 0) {
      setMoveError(errors.join(" / "));
    }
    if (moved.length === 0) return;
    // 表示中の検索結果は、この通知を受けた上の購読が取り直す（そのときの検索語で）
    await emitFileMoved();
  }, []);

  const handleTrashFolder = useCallback(
    async (path: string) => {
      if (!selectedFavorite) return false;
      setTrashError(null);
      // このフォルダ自身か中にあるお気に入りは行き先を失うので、登録も一緒に外す
      let lostFavorites: string[] = [];
      try {
        const [fileCount, favorites] = await Promise.all([countFiles(path), getFavorites()]);
        lostFavorites = favoritesInside(favorites, path);
        const ok = await confirm({
          title: folderTrashConfirmTitle(path),
          lines: folderTrashConfirmLines(fileCount, lostFavorites.length),
          confirmLabel: "ゴミ箱に移動",
          danger: true,
        });
        if (!ok) return false;
        await trashFolder(path);
      } catch (err) {
        setTrashError(errorToString(err));
        return false;
      }
      if (lostFavorites.length > 0) {
        try {
          await removeFavorites(lostFavorites);
          setFavoritesRefresh((n) => n + 1);
        } catch (err) {
          console.error("Failed to remove favorites of a trashed folder:", err);
        }
      }
      setSelectedFolder((current) => selectionAfterRemoval(current, path, selectedFavorite));
      await emitFileTrashed();
      return true;
    },
    [selectedFavorite, confirm],
  );

  return (
    <div className="app">
      <div className="toolbar">
        <button type="button" className="toolbar__btn" onClick={handleAddFolder}>
          フォルダを追加
        </button>
        <button
          type="button"
          className="toolbar__btn"
          onClick={handleReload}
          disabled={!selectedFavorite}
        >
          再読み込み
        </button>
        <button
          type="button"
          className="toolbar__btn"
          onClick={updater.checkNow}
          disabled={updaterBusy}
        >
          アップデートを確認
        </button>
        <UpdateBanner
          state={updater.state}
          onInstall={updater.install}
          onRestart={updater.restart}
          onRetry={updater.retry}
          onDismiss={updater.dismiss}
        />
        <div className="toolbar__search-box">
          <input
            type="text"
            className="toolbar__search"
            placeholder={
              selectedFavorite ? `${fileNameFromPath(selectedFavorite)} 内を検索...` : "検索..."
            }
            aria-label="フォルダとファイルを検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchQuery) {
                e.preventDefault();
                clearSearch();
              }
            }}
            disabled={!selectedFavorite}
          />
          {searchQuery && (
            <button
              type="button"
              className="toolbar__search-clear"
              aria-label="検索をクリア"
              title="検索をクリア (Esc)"
              onClick={clearSearch}
            >
              ×
            </button>
          )}
        </div>
        {moveError && (
          <div className="toolbar__banner toolbar__banner--error" role="alert">
            <span>移動できませんでした: {moveError}</span>
            <button
              type="button"
              className="toolbar__banner-close"
              aria-label="閉じる"
              onClick={() => setMoveError(null)}
            >
              ×
            </button>
          </div>
        )}
        {favoriteError && (
          <div className="toolbar__banner toolbar__banner--error" role="alert">
            <span>お気に入りを保存できませんでした: {favoriteError}</span>
            <button
              type="button"
              className="toolbar__banner-close"
              aria-label="閉じる"
              onClick={() => setFavoriteError(null)}
            >
              ×
            </button>
          </div>
        )}
        {trashError && (
          <div className="toolbar__banner toolbar__banner--error" role="alert">
            <span>ゴミ箱に移動できませんでした: {trashError}</span>
            <button
              type="button"
              className="toolbar__banner-close"
              aria-label="閉じる"
              onClick={() => setTrashError(null)}
            >
              ×
            </button>
          </div>
        )}
      </div>
      <div
        className={`app__columns ${isResizing ? "app__columns--resizing" : ""}`}
        ref={columnsRef}
      >
        <FavoritesSidebar
          selectedPath={selectedFavorite}
          onSelect={handleFavoriteSelect}
          refreshTrigger={favoritesRefresh}
          onFileDrop={handleFileDrop}
          onAddFolder={handleAddFolder}
          onFavoriteRemoved={handleFavoriteRemoved}
          onFavoriteError={setFavoriteError}
        />
        <div className="app__tree-column" style={{ width: treeColumnWidth, flexShrink: 0 }}>
          {selectedFavorite ? (
            <FolderTree
              // お気に入りごとに作り直す。読み込みの途中で切り替えても、前のお気に入りの結果が混ざらない
              key={selectedFavorite}
              rootPath={selectedFavorite}
              selectedPath={selectedFolder}
              onFolderSelect={handleFolderSelect}
              onFavoriteAdded={handleFavoriteAdded}
              onFavoriteError={setFavoriteError}
              searchFolders={searchFolders}
              searchError={searchError}
              revealPath={revealPath}
              onRevealComplete={handleRevealComplete}
              onFileDrop={handleFileDrop}
              onTrashFolder={handleTrashFolder}
              reloadTrigger={reloadTrigger}
            />
          ) : (
            <div className="column-empty">
              <p>左の一覧からお気に入りのフォルダを選ぶと、ここにフォルダツリーが表示されます</p>
            </div>
          )}
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle is mouse-only UI */}
        <div className="app__resize-handle" onMouseDown={startResize} />
        <div className="app__file-column">
          <FileList
            folderPath={selectedFolder || selectedFavorite}
            onArchiveSelect={openViewerWindow}
            onOpenFiles={openViewerWindows}
            onFolderSelect={handleFolderSelect}
            searchResults={searchResults}
            searchError={searchError}
            searchRoot={selectedFavorite}
            reloadTrigger={reloadTrigger}
            onFileDrop={handleFileDrop}
            recentFolders={recentFolders}
            onRecentSelect={handleRecentSelect}
            onTrashError={setTrashError}
          />
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

export default App;
