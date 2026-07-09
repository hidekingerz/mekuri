/**
 * 設定ファイル（settings.json）の保存先パス解決。
 *
 * Tauri 版は `tauri-plugin-store` の `load("settings.json")` が、アプリの
 * app config dir（`app_config_dir`）配下に settings.json を置いていた
 * （`src-tauri/src/lib.rs` の plugin 登録、identifier=`com.mekuri.reader`）。
 * Deno 版でも同じパスを使うため、OS 別の config ディレクトリ + identifier を
 * 再現する純粋ロジックをここに実装する。
 *
 * Tauri v2 の `app_config_dir` は OS 標準の config ディレクトリ（`dirs::config_dir`
 * 相当）に identifier を結合したもの:
 *   - macOS:   $HOME/Library/Application Support/<identifier>
 *   - Linux:   $XDG_CONFIG_HOME/<identifier>（無ければ $HOME/.config/<identifier>）
 *   - Windows: %APPDATA%\<identifier>
 *
 * Deno Desktop API には依存させない（テスト容易性のため OS と環境変数取得を注入可能にする）。
 */

/** Tauri の identifier（`src-tauri/tauri.conf.json`）。app config dir に結合する。 */
export const APP_IDENTIFIER = "com.mekuri.reader";

/** 設定ファイル名（Tauri 版 `src/api/store.ts` の `STORE_NAME` と一致）。 */
export const SETTINGS_FILE_NAME = "settings.json";

/** パス解決に必要な実行環境。テストでは差し替える。 */
export interface PathEnv {
  /** プラットフォーム識別子（`Deno.build.os` 相当）。 */
  os: "darwin" | "linux" | "windows";
  /** 環境変数取得（`Deno.env.get` 相当）。 */
  getEnv: (key: string) => string | undefined;
}

/** 既定の実行環境（Deno ランタイム情報を利用）。 */
function denoEnv(): PathEnv {
  return {
    os: Deno.build.os as PathEnv["os"],
    getEnv: (key) => Deno.env.get(key),
  };
}

/** OS 別のパス区切り文字。 */
function separator(os: PathEnv["os"]): string {
  return os === "windows" ? "\\" : "/";
}

/** 必須の環境変数を取り出す。未設定なら例外。 */
function requireEnv(env: PathEnv, key: string): string {
  const value = env.getEnv(key);
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * OS 標準の config ディレクトリ（`dirs::config_dir` 相当）。identifier は含まない。
 */
function configBaseDir(env: PathEnv): string {
  const sep = separator(env.os);
  switch (env.os) {
    case "darwin":
      return `${requireEnv(env, "HOME")}${sep}Library${sep}Application Support`;
    case "linux": {
      const xdg = env.getEnv("XDG_CONFIG_HOME");
      if (xdg !== undefined && xdg.length > 0) {
        return xdg;
      }
      return `${requireEnv(env, "HOME")}${sep}.config`;
    }
    case "windows":
      return requireEnv(env, "APPDATA");
  }
}

/**
 * アプリの app config dir（Tauri v2 `app_config_dir` 相当）。
 * OS 標準 config ディレクトリに identifier を結合する。
 */
export function appConfigDir(env: PathEnv = denoEnv()): string {
  const sep = separator(env.os);
  return `${configBaseDir(env)}${sep}${APP_IDENTIFIER}`;
}

/**
 * settings.json のフルパス。Tauri 版 `tauri-plugin-store` の保存先と一致する。
 * アプリ層は `Store.load(settingsPath(), { autoSave: true })` で開く。
 */
export function settingsPath(env: PathEnv = denoEnv()): string {
  const sep = separator(env.os);
  return `${appConfigDir(env)}${sep}${SETTINGS_FILE_NAME}`;
}
