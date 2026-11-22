import { useCallback, useEffect, useState } from "react";
import { getFavorites, removeFavorite } from "../../api/favorites";
import { readDroppedPaths } from "../../api/fileDrop";
import { useContextMenu } from "../../hooks/useContextMenu";
import { dragSource } from "../../utils/fileDrag";
import { fileNameFromPath } from "../../utils/windowLabel";
import { FolderIcon } from "../Icons/Icons";

type FavoritesSidebarProps = {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  refreshTrigger?: number;
  onFileDrop?: (srcPaths: string[], destDir: string) => void;
  /** 空状態の「フォルダを追加」ボタンから呼ぶ */
  onAddFolder?: () => void;
  /** お気に入りを外したときに呼ぶ */
  onFavoriteRemoved?: () => void;
};

export function FavoritesSidebar({
  selectedPath,
  onSelect,
  refreshTrigger,
  onFileDrop,
  onAddFolder,
  onFavoriteRemoved,
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
      onFavoriteRemoved?.();
    }
  }, [contextMenu, closeContextMenu, loadFavorites, onFavoriteRemoved]);

  return (
    <div className="favorites-sidebar">
      <div className="favorites-sidebar__header">お気に入り</div>
      <div className="favorites-sidebar__list">
        {favorites.length === 0 ? (
          <div className="favorites-sidebar__empty">
            <p>お気に入りはまだありません</p>
            <p className="favorites-sidebar__empty-hint">
              よく使うフォルダを登録すると、ここから開けます
            </p>
            {onAddFolder && (
              <button type="button" className="toolbar__btn" onClick={onAddFolder}>
                フォルダを追加
              </button>
            )}
          </div>
        ) : (
          favorites.map((path) => (
            <button
              key={path}
              type="button"
              className={`favorites-sidebar__item ${selectedPath === path ? "favorites-sidebar__item--selected" : ""}${dragOverPath === path ? " favorites-sidebar__item--drop-target" : ""}`}
              onClick={() => onSelect(path)}
              onContextMenu={(e) => openContextMenu(e, path)}
              onDragOver={(e) => {
                if (onFileDrop && dragSource(e.dataTransfer.types)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverPath(path);
                }
              }}
              onDragLeave={() => setDragOverPath(null)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOverPath(null);
                const srcPaths = await readDroppedPaths(e.dataTransfer);
                if (srcPaths.length > 0 && onFileDrop) {
                  onFileDrop(srcPaths, path);
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
            お気に入りから削除
          </button>
        </div>
      )}
    </div>
  );
}
