/**
 * Generate a deterministic hash code string from input.
 * Used to create unique window labels from archive paths.
 */
export function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a unique Tauri window label for a viewer window.
 */
export function viewerLabel(archivePath: string): string {
  return "viewer-" + hashCode(archivePath);
}

/**
 * Extract the file name from a path (cross-platform).
 */
export function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() || "Viewer";
}
