import { useCallback, useEffect, useState } from "react";
import { getFavorites, removeFavorite } from "../../api/favorites";
import { FolderIcon } from "../Icons/Icons";

interface FavoritesSidebarProps {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  refreshTrigger?: number;
}

export function FavoritesSidebar({
  selectedPath,
  onSelect,
  refreshTrigger,
}: FavoritesSidebarProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);

  const loadFavorites = useCallback(async () => {
    const favs = await getFavorites();
    setFavorites(favs);
  }, []);

  useEffect(() => {
    // refreshTrigger is used to force reload when favorites are added/removed
    void refreshTrigger;
    loadFavorites();
  }, [loadFavorites, refreshTrigger]);

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  }, []);

  const handleRemove = useCallback(async () => {
    if (contextMenu) {
      await removeFavorite(contextMenu.path);
      setContextMenu(null);
      loadFavorites();
    }
  }, [contextMenu, loadFavorites]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu, closeContextMenu]);

  const getDisplayName = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

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
              onContextMenu={(e) => handleContextMenu(e, path)}
              title={path}
            >
              <FolderIcon size={14} />
              <span className="favorites-sidebar__name">{getDisplayName(path)}</span>
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
