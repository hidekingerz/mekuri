import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { getSiblingArchives } from "../api/directory";
import { fileNameFromPath } from "../utils/windowLabel";

export function useSiblingNavigation(
  archivePath: string | null,
  onNavigate: (newPath: string) => void,
) {
  useEffect(() => {
    if (!archivePath) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;

      e.preventDefault();

      try {
        const { archives, currentIndex } = await getSiblingArchives(archivePath);
        if (currentIndex === -1 || archives.length <= 1) return;

        let newIndex: number;
        if (e.key === "ArrowUp") {
          newIndex = currentIndex + 1;
          if (newIndex >= archives.length) return;
        } else {
          newIndex = currentIndex - 1;
          if (newIndex < 0) return;
        }

        const newPath = archives[newIndex];
        onNavigate(newPath);

        const fileName = fileNameFromPath(newPath);
        await getCurrentWindow().setTitle(`${fileName} - mekuri`);
      } catch (err) {
        console.error("Failed to navigate to sibling archive:", err);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [archivePath, onNavigate]);
}
