import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { FolderTree } from "./components/FolderTree/FolderTree";

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);

  const handleSelectFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      setRootPath(selected);
    }
  }, []);

  const handleArchiveSelect = useCallback(async (archivePath: string) => {
    // Create a unique window label from the path
    const label = "viewer-" + hashCode(archivePath);

    // Check if window already exists
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    const fileName = archivePath.split(/[/\\]/).pop() ?? "Viewer";

    new WebviewWindow(label, {
      url: `viewer.html?archive=${encodeURIComponent(archivePath)}`,
      title: `${fileName} - mekuri`,
      width: 1200,
      height: 900,
    });
  }, []);

  return (
    <div className="app">
      <div className="toolbar">
        <button className="toolbar__btn" onClick={handleSelectFolder}>
          Open Folder
        </button>
        {rootPath && <span className="toolbar__path">{rootPath}</span>}
      </div>
      <div className="tree-container">
        {rootPath ? (
          <FolderTree
            rootPath={rootPath}
            onArchiveSelect={handleArchiveSelect}
          />
        ) : (
          <div className="tree-empty">
            <p>Click "Open Folder" to browse archives</p>
          </div>
        )}
      </div>
    </div>
  );
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export default App;
