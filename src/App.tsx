import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { moveFiles } from "./api/directory";
import { addFavorite } from "./api/favorites";
import { emitFileMoved } from "./api/fileEvents";
import { openViewerWindow } from "./api/viewerWindow";
import { FavoritesSidebar } from "./components/FavoritesSidebar/FavoritesSidebar";
import { FileList } from "./components/FileList/FileList";
import { FolderTree } from "./components/FolderTree/FolderTree";
import { UpdateBanner } from "./components/UpdateBanner/UpdateBanner";
import { useColumnResize } from "./hooks/useColumnResize";
import { useFolderSearch } from "./hooks/useFolderSearch";
import { useMainWindowSetup } from "./hooks/useMainWindowSetup";
import { useUpdater } from "./hooks/useUpdater";
import { DEFAULT_TREE_COLUMN_WIDTH } from "./utils/constants";
import { appTitle, fileNameFromPath } from "./utils/windowLabel";

function App() {
  const [selectedFavorite, setSelectedFavorite] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [favoritesRefresh, setFavoritesRefresh] = useState(0);
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
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
    if (selected) {
      await addFavorite(selected);
      setFavoritesRefresh((n) => n + 1);
      setSelectedFavorite(selected);
      setSelectedFolder(null);
    }
  }, []);

  const handleReload = useCallback(() => {
    if (searchActive) {
      void rerunSearch();
      return;
    }
    setReloadTrigger((n) => n + 1);
  }, [searchActive, rerunSearch]);

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

  const handleRevealComplete = useCallback(() => {
    setRevealPath(null);
  }, []);

  const handleFavoriteAdded = useCallback(() => {
    setFavoritesRefresh((n) => n + 1);
  }, []);

  const handleFileDrop = useCallback(
    async (srcPaths: string[], destDir: string) => {
      setMoveError(null);
      const { moved, errors } = await moveFiles(srcPaths, destDir);
      if (errors.length > 0) {
        setMoveError(errors.join(" / "));
      }
      if (moved.length === 0) return;
      await emitFileMoved();
      // Refresh the active search so a moved-out entry doesn't linger stale.
      await rerunSearch();
    },
    [rerunSearch],
  );

  return (
    <div className="app">
      <div className="toolbar">
        <button type="button" className="toolbar__btn" onClick={handleAddFolder}>
          Add Folder
        </button>
        <button
          type="button"
          className="toolbar__btn"
          onClick={handleReload}
          disabled={!selectedFavorite}
        >
          Reload
        </button>
        <button
          type="button"
          className="toolbar__btn"
          onClick={updater.checkNow}
          disabled={updaterBusy}
        >
          Check for Updates
        </button>
        <UpdateBanner
          state={updater.state}
          onInstall={updater.install}
          onRestart={updater.restart}
          onRetry={updater.retry}
          onDismiss={updater.dismiss}
        />
        <input
          type="text"
          className="toolbar__search"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={!selectedFavorite}
        />
        {moveError && (
          <div className="toolbar__error" role="alert">
            <span>Failed to move: {moveError}</span>
            <button
              type="button"
              className="toolbar__error-close"
              onClick={() => setMoveError(null)}
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
        />
        <div className="app__tree-column" style={{ width: treeColumnWidth, flexShrink: 0 }}>
          {selectedFavorite ? (
            <FolderTree
              rootPath={selectedFavorite}
              selectedPath={selectedFolder}
              onFolderSelect={handleFolderSelect}
              onFavoriteAdded={handleFavoriteAdded}
              searchFolders={searchFolders}
              revealPath={revealPath}
              onRevealComplete={handleRevealComplete}
              onFileDrop={handleFileDrop}
              reloadTrigger={reloadTrigger}
            />
          ) : (
            <div className="column-empty">
              <p>Select a favorite folder</p>
            </div>
          )}
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle is mouse-only UI */}
        <div className="app__resize-handle" onMouseDown={startResize} />
        <div className="app__file-column">
          <FileList
            folderPath={selectedFolder || selectedFavorite}
            onArchiveSelect={openViewerWindow}
            onFolderSelect={handleFolderSelect}
            searchResults={searchResults}
            reloadTrigger={reloadTrigger}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
