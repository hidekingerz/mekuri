import { useCallback, useEffect, useState } from "react";

type ContextMenuState = {
  x: number;
  y: number;
  path: string;
};

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const openContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 外側のクリック、別の場所の右クリック、Esc、ウィンドウのフォーカス喪失で閉じる。
  // 右クリックは capture で先に受けるので、同じ一覧の別の項目なら、閉じたあとにその項目のメニューが開く
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => closeContextMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("contextmenu", closeContextMenu, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", closeContextMenu);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("contextmenu", closeContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", closeContextMenu);
    };
  }, [contextMenu, closeContextMenu]);

  return { contextMenu, openContextMenu, closeContextMenu };
}
