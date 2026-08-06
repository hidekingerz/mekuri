import { useCallback, useEffect, useState } from "react";
import { getFavorites, removeFavorite } from "../../api/favorites";
import { useContextMenu } from "../../hooks/useContextMenu";
import { FILE_DRAG_MIME } from "../../utils/constants";
import { fileNameFromPath } from "../../utils/windowLabel";
import { FolderIcon } from "../Icons/Icons";

type FavoritesSidebarProps = {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  refreshTrigger?: number;
  onFileDrop?: (srcPath: string, destDir: string) => void;
};

export function FavoritesSidebar({
  selectedPath,
  onSelect,
  refreshTrigger,
  onFileDrop,
}: FavoritesSidebarProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  const loadFavorites = useCallback(async () => {
    const favs = await getFavorites();
    setFavorites(favs);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTrigger is intentionally used to force re-fetch
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites, refreshTrigger]);

  const handleRemove = useCallback(async () => {
    if (contextMenu) {
      await removeFavorite(contextMenu.path);
      closeContextMenu();
      loadFavorites();
    }
  }, [contextMenu, closeContextMenu, loadFavorites]);

  return (
    <div className="favorites-sidebar">
      <div className="favorites-sidebar__header">Favorites</div>
      <div className="favorites-sidebar__list">
        {favorites.length === 0 ? (
          <div className="favorites-sidebar__empty">No favorites</div>
        ) : (
          favorites.map((path) => (
            <button
              key={path}
              type="button"
              className={`favorites-sidebar__item ${selectedPath === path ? "favorites-sidebar__item--selected" : ""}${dragOverPath === path ? " favorites-sidebar__item--drop-target" : ""}`}
              onClick={() => onSelect(path)}
              onContextMenu={(e) => openContextMenu(e, path)}
              onDragOver={(e) => {
                if (onFileDrop && e.dataTransfer.types.includes(FILE_DRAG_MIME)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverPath(path);
                }
              }}
              onDragLeave={() => setDragOverPath(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverPath(null);
                const srcPath = e.dataTransfer.getData(FILE_DRAG_MIME);
                if (srcPath && onFileDrop) {
                  onFileDrop(srcPath, path);
                }
              }}
              title={path}
            >
              <FolderIcon size={14} />
              <span className="favorites-sidebar__name">{fileNameFromPath(path)}</span>
            </button>
          ))
        )}
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button type="button" className="context-menu__item" onClick={handleRemove}>
            Remove from favorites
          </button>
        </div>
      )}
    </div>
  );
}
