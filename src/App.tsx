import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { FolderTree } from "./components/FolderTree/FolderTree";
import { fileNameFromPath, viewerLabel } from "./utils/windowLabel";

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);

  const handleSelectFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      setRootPath(selected);
    }
  }, []);

  const handleArchiveSelect = useCallback(async (archivePath: string) => {
    const label = viewerLabel(archivePath);

    // Check if window already exists
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    new WebviewWindow(label, {
      url: `viewer.html?archive=${encodeURIComponent(archivePath)}`,
      title: `${fileNameFromPath(archivePath)} - mekuri`,
      width: 1200,
      height: 900,
    });
  }, []);

  return (
    <div className="app">
      <div className="toolbar">
        <button type="button" className="toolbar__btn" onClick={handleSelectFolder}>
          Open Folder
        </button>
        {rootPath && <span className="toolbar__path">{rootPath}</span>}
      </div>
      <div className="tree-container">
        {rootPath ? (
          <FolderTree rootPath={rootPath} onArchiveSelect={handleArchiveSelect} />
        ) : (
          <div className="tree-empty">
            <p>Click "Open Folder" to browse archives</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
