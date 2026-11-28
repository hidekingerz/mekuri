import { type DragEvent, useCallback, useState } from "react";
import { readDroppedPaths } from "../api/fileDrop";
import { dragSource } from "../utils/fileDrag";

/**
 * フォルダの行をファイルのドロップ先にする。アプリ内のドラッグと Finder などからのドラッグを受け、
 * 落とされたファイルを `onFileDrop(パス, フォルダ)` へ渡す。`dragOverPath` は強調表示に使う。
 */
export function useFolderDropTarget(onFileDrop?: (srcPaths: string[], destDir: string) => void) {
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const dropProps = useCallback(
    (folderPath: string) => ({
      onDragOver: (e: DragEvent) => {
        if (!onFileDrop || !dragSource(e.dataTransfer.types)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverPath(folderPath);
      },
      onDragLeave: () => {
        setDragOverPath((current) => (current === folderPath ? null : current));
      },
      onDrop: async (e: DragEvent) => {
        if (!onFileDrop || !dragSource(e.dataTransfer.types)) return;
        e.preventDefault();
        setDragOverPath(null);
        const srcPaths = await readDroppedPaths(e.dataTransfer);
        if (srcPaths.length > 0) onFileDrop(srcPaths, folderPath);
      },
    }),
    [onFileDrop],
  );

  return { dragOverPath, dropProps };
}
