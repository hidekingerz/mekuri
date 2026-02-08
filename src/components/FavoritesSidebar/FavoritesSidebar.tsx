import { useCallback, useEffect, useState } from "react";
import { getFavorites, removeFavorite } from "../../api/favorites";
import { useContextMenu } from "../../hooks/useContextMenu";
import { fileNameFromPath } from "../../utils/windowLabel";
import { FolderIcon } from "../Icons/Icons";

type FavoritesSidebarProps = {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  refreshTrigger?: number;
};

export function FavoritesSidebar({
  selectedPath,
  onSelect,
  refreshTrigger,
}: FavoritesSidebarProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  const loadFavorites = useCallback(async () => {
    const favs = await getFavorites();
    setFavorites(favs);
  }, []);

  useEffect(() => {
    // refreshTrigger is used to force reload when favorites are added/removed
    void refreshTrigger;
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
              className={`favorites-sidebar__item ${selectedPath === path ? "favorites-sidebar__item--selected" : ""}`}
              onClick={() => onSelect(path)}
              onContextMenu={(e) => openContextMenu(e, path)}
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
