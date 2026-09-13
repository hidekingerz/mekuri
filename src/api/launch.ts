import { invoke } from "@tauri-apps/api/core";

/** Finder の「このアプリケーションで開く」経由で起動されたかどうか */
export async function wasOpenedViaFile(): Promise<boolean> {
  return invoke<boolean>("was_opened_via_file");
}
