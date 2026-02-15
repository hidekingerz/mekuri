const ARCHIVE_EXTENSIONS = ["zip", "cbz", "rar", "cbr", "7z"];
const PDF_EXTENSIONS = ["pdf"];

function getExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return "";
  return path.slice(lastDot + 1).toLowerCase();
}

export type FileType = "archive" | "pdf" | "unknown";

export function detectFileType(path: string): FileType {
  const ext = getExtension(path);
  if (ARCHIVE_EXTENSIONS.includes(ext)) return "archive";
  if (PDF_EXTENSIONS.includes(ext)) return "pdf";
  return "unknown";
}
