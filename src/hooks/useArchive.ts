import { invoke } from "@tauri-apps/api/core";

export type ArchiveContents =
  | { type: "Images"; names: string[] }
  | { type: "NestedArchives"; names: string[] }
  | { type: "Empty" };

export async function listArchiveImages(archivePath: string): Promise<string[]> {
  return invoke<string[]>("list_archive_images", {
    archivePath,
  });
}

export async function getArchiveImage(archivePath: string, entryName: string): Promise<string> {
  return invoke<string>("get_archive_image", {
    archivePath,
    entryName,
  });
}

export async function analyzeArchiveContents(archivePath: string): Promise<ArchiveContents> {
  return invoke<ArchiveContents>("analyze_archive_contents", {
    archivePath,
  });
}

export async function extractNestedArchive(
  parentPath: string,
  nestedName: string,
): Promise<string> {
  return invoke<string>("extract_nested_archive", {
    parentPath,
    nestedName,
  });
}
