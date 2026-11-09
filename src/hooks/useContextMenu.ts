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

  // 外側のクリック、Esc、ウィンドウのフォーカス喪失で閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => closeContextMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", closeContextMenu);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", closeContextMenu);
    };
  }, [contextMenu, closeContextMenu]);

  return { contextMenu, openContextMenu, closeContextMenu };
}
