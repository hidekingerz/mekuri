import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { addFavorite } from "./api/favorites";
import { getViewerSettings, getWindowSettings, saveWindowSettings } from "./api/settings";
import { FavoritesSidebar } from "./components/FavoritesSidebar/FavoritesSidebar";
import { FileList } from "./components/FileList/FileList";
import { FolderTree } from "./components/FolderTree/FolderTree";
import { useColumnResize } from "./hooks/useColumnResize";
import { useWindowResize } from "./hooks/useWindowResize";
import { DEFAULT_TREE_COLUMN_WIDTH, VIEWER_MIN_HEIGHT, VIEWER_MIN_WIDTH } from "./utils/constants";
import { fileNameFromPath, viewerLabel } from "./utils/windowLabel";

function App() {
  const [selectedFavorite, setSelectedFavorite] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [favoritesRefresh, setFavoritesRefresh] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const { treeColumnWidth, setWidth, isResizing, startResize } = useColumnResize(
    DEFAULT_TREE_COLUMN_WIDTH,
    columnsRef,
  );

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      const win = getCurrentWindow();
      try {
        const settings = await getWindowSettings();
        setWidth(settings.treeColumnWidth);
        await win.setSize(new LogicalSize(settings.width, settings.height));
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        // Always show window
        await win.show();
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

  const handleAddFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      await addFavorite(selected);
      setFavoritesRefresh((n) => n + 1);
      setSelectedFavorite(selected);
      setSelectedFolder(null);
    }
  }, []);

  const handleFavoriteSelect = useCallback((path: string) => {
    setSelectedFavorite(path);
    setSelectedFolder(null);
  }, []);

  const handleFolderSelect = useCallback((path: string) => {
    setSelectedFolder(path);
  }, []);

  const handleFavoriteAdded = useCallback(() => {
    setFavoritesRefresh((n) => n + 1);
  }, []);

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
      </div>
      <div
        className={`app__columns ${isResizing ? "app__columns--resizing" : ""}`}
        ref={columnsRef}
      >
        <FavoritesSidebar
          selectedPath={selectedFavorite}
          onSelect={handleFavoriteSelect}
          refreshTrigger={favoritesRefresh}
        />
        <div className="app__tree-column" style={{ width: treeColumnWidth, flexShrink: 0 }}>
          {selectedFavorite ? (
            <FolderTree
              rootPath={selectedFavorite}
              selectedPath={selectedFolder}
              onFolderSelect={handleFolderSelect}
              onFavoriteAdded={handleFavoriteAdded}
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
          />
        </div>
      </div>
    </div>
  );
}

export default App;
