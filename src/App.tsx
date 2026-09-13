import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { moveFiles, searchDirectory } from "./api/directory";
import { addFavorite } from "./api/favorites";
import { getViewerSettings, getWindowSettings, saveWindowSettings } from "./api/settings";
import { FavoritesSidebar } from "./components/FavoritesSidebar/FavoritesSidebar";
import { FileList } from "./components/FileList/FileList";
import { FolderTree } from "./components/FolderTree/FolderTree";
import { UpdateBanner } from "./components/UpdateBanner/UpdateBanner";
import { useColumnResize } from "./hooks/useColumnResize";
import { useUpdater } from "./hooks/useUpdater";
import { useWindowResize } from "./hooks/useWindowResize";
import type { DirectoryEntry } from "./types";
import { DEFAULT_TREE_COLUMN_WIDTH, VIEWER_MIN_HEIGHT, VIEWER_MIN_WIDTH } from "./utils/constants";
import { fileNameFromPath, viewerLabel } from "./utils/windowLabel";

function App() {
  const [selectedFavorite, setSelectedFavorite] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [favoritesRefresh, setFavoritesRefresh] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DirectoryEntry[] | null>(null);
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const columnsRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { treeColumnWidth, setWidth, isResizing, startResize } = useColumnResize(
    DEFAULT_TREE_COLUMN_WIDTH,
    columnsRef,
  );
  const updater = useUpdater();
  const updaterBusy =
    updater.state.status === "checking" ||
    updater.state.status === "downloading" ||
    updater.state.status === "ready";

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      const win = getCurrentWindow();
      // Finder のファイルオープン起動ではメインウィンドウを表示しない
      let openedViaFile = false;
      try {
        openedViaFile = await invoke<boolean>("was_opened_via_file");
      } catch (err) {
        console.error("Failed to query launch state:", err);
      }
      try {
        const settings = await getWindowSettings();
        setWidth(settings.treeColumnWidth);
        await win.setSize(new LogicalSize(settings.width, settings.height));
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        if (!openedViaFile) {
          await win.show();
        }
        setSettingsLoaded(true);
      }
    }
    loadSettings();
  }, [setWidth]);

  const handleWindowResize = useCallback(async (size: { width: number; height: number }) => {
    await saveWindowSettings(size);
  }, []);
  useWindowResize(handleWindowResize, settingsLoaded);

  // Update main window title
  useEffect(() => {
    if (selectedFavorite) {
      const folderName = fileNameFromPath(selectedFavorite);
      getCurrentWindow().setTitle(`${folderName} - mekuri`);
    } else {
      getCurrentWindow().setTitle("mekuri");
    }
  }, [selectedFavorite]);

  const runSearch = useCallback(async (root: string, query: string) => {
    try {
      const results = await searchDirectory(root, query);
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!searchQuery || !selectedFavorite) {
      setSearchResults(null);
      return;
    }

    searchTimerRef.current = setTimeout(() => {
      void runSearch(selectedFavorite, searchQuery);
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, selectedFavorite, runSearch]);

  // Reset search when favorite changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: must reset search when selectedFavorite changes
  useEffect(() => {
    setSearchQuery("");
    setSearchResults(null);
  }, [selectedFavorite]);

  const searchFolders = useMemo(() => {
    if (searchResults === null) return null;
    return searchResults.filter((e) => e.is_dir);
  }, [searchResults]);

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
    if (searchResults !== null && selectedFavorite && searchQuery) {
      void runSearch(selectedFavorite, searchQuery);
      return;
    }
    setReloadTrigger((n) => n + 1);
  }, [searchResults, selectedFavorite, searchQuery, runSearch]);

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
      setSearchQuery("");
      setSearchResults(null);
    },
    [searchResults],
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
      const { emit } = await import("@tauri-apps/api/event");
      await emit("file-moved");
      // Refresh the active search so a moved-out entry doesn't linger stale.
      if (searchResults !== null && selectedFavorite && searchQuery) {
        await runSearch(selectedFavorite, searchQuery);
      }
    },
    [searchResults, selectedFavorite, searchQuery, runSearch],
  );

  const handleArchiveSelect = useCallback(async (archivePath: string) => {
    const label = viewerLabel(archivePath);

    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    const viewerSettings = await getViewerSettings();
    const webview = new WebviewWindow(label, {
      url: `viewer.html?archive=${encodeURIComponent(archivePath)}`,
      title: `${fileNameFromPath(archivePath)} - mekuri`,
      width: viewerSettings.width,
      height: viewerSettings.height,
      minWidth: VIEWER_MIN_WIDTH,
      minHeight: VIEWER_MIN_HEIGHT,
      visible: true,
      // Tauri のネイティブ drag-drop 横取りを無効化しないと、
      // webview 内の HTML5 D&D（ファイル移動）が発火しない
      dragDropEnabled: false,
    });
    webview.once("tauri://error", (e) => {
      console.error("Failed to create viewer window:", e);
    });
  }, []);

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
            onArchiveSelect={handleArchiveSelect}
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
