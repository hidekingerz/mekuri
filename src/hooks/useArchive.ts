import { invoke } from "@tauri-apps/api/core";

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
