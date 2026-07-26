# Finder「このアプリケーションで開く」対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** macOS Finder の「このアプリケーションで開く」に mekuri を表示し、選択されたアーカイブ/PDF をビューワーウィンドウで直接開く（新規起動時はメインウィンドウ非表示）。

**Architecture:** `bundle.fileAssociations` で Info.plist に関連付けを宣言し、macOS の `RunEvent::Opened { urls }` を Rust で処理してビューワー `WebviewWindow` を直接生成する。ウィンドウラベルは JS `windowLabel.ts` 互換のハッシュを Rust に移植し、フォルダツリー経由と二重オープン防止を共有する。フロントは起動時に `was_opened_via_file` コマンドを問い合わせてメインウィンドウの `show()` を抑制する。

**Tech Stack:** Tauri v2（Rust）+ `tauri-plugin-store` + `percent-encoding` / React 19 + TypeScript / cargo test + Vitest

**Spec:** `docs/superpowers/specs/2026-07-26-finder-open-with-design.md`

## Global Constraints

- ブランチ: `feat/finder-open-with`（`main` ベース）。`main` へ直接コミットしない
- 対象拡張子: `zip` / `cbz` / `rar` / `cbr` / `pdf`（ASCII 大文字小文字を区別しない）
- ウィンドウラベルは JS 実装（`src/utils/windowLabel.ts`）と**同一入力→同一出力**であること
- ビューワー既定サイズ 1200×900、最小サイズ 600×400（フロント `src/utils/constants.ts` と同値）
- **CI の Rust ジョブは ubuntu-latest で `cargo fmt --check` / `cargo clippy -- -D warnings` / `cargo test` を実行する。`RunEvent::Opened` / `RunEvent::Reopen` は macOS 限定 variant のため、macOS 固有コードはすべて `#[cfg(target_os = "macos")]` で守り、Linux ビルドでも警告ゼロでコンパイルできること**
- Rust の規約: `commands/` は薄い IPC 層、純ロジックは Tauri 非依存で単体テスト可能に。エラーは握りつぶさず `eprintln!` でログ
- コミットメッセージは英語
- 品質ゲート（Rust）: `cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test`
- 品質ゲート（フロント）: `pnpm format` / `pnpm lint` / `pnpm test` / `npx tsc --noEmit`

---

### Task 1: window_label.rs — JS 互換ラベル計算（純ロジック）

**Files:**
- Create: `src-tauri/src/window_label.rs`
- Modify: `src-tauri/src/lib.rs`（`pub mod window_label;` を追加するだけ）

**Interfaces:**
- Consumes: なし
- Produces（Task 2 が使用）:
  - `pub fn hash_code(s: &str) -> String`
  - `pub fn viewer_label(path: &str) -> String`
  - `pub fn file_name_from_path(path: &str) -> String`

**背景（実装者向け）:** JS 側の参照実装は `src/utils/windowLabel.ts`。互換性の要点は (1) `charCodeAt` = UTF-16 コード単位でイテレートする、(2) `(hash << 5) - hash + char` は「i32 に切り詰めた `hash << 5`」から double 演算し `|0` で i32 に戻る、(3) `Math.abs` は double なので `i32::MIN` でもオーバーフローしない（Rust では i64 に広げる）、(4) `toString(36)` は小文字。

- [ ] **Step 1: 失敗するテストを含むモジュールを作成**

`src-tauri/src/window_label.rs` を以下の内容で作成（まずテストのみ書いて実装は `todo!()` にするのではなく、Rust ではモジュール単位でコンパイルが必要なため、テストを先に書きスタブで RED を確認する）:

```rust
//! JS (src/utils/windowLabel.ts) 互換のウィンドウラベル計算。
//! フォルダツリー経由（JS）と Finder 経由（Rust）で同一アーカイブの
//! ラベルを一致させ、二重オープン防止を共有するため、同一入力で
//! 同一出力になることが要件。テストベクタは JS 実装の実出力。

/// JS の hashCode() と同一出力を返す。
/// UTF-16 コード単位で `(hash << 5) - hash + unit` を i32 wrapping で畳み込み、
/// 絶対値を base36 文字列にする。
pub fn hash_code(s: &str) -> String {
    let mut hash: i32 = 0;
    for unit in s.encode_utf16() {
        // JS: hash = (hash << 5) - hash + char; hash |= 0;
        // (hash << 5) は int32 に切り詰め、その後の加減算は double（正確）で
        // 行われ |0 で int32 に戻る。i64 で計算し低位 32bit を取れば等価。
        let shifted = hash.wrapping_shl(5) as i64;
        hash = (shifted - hash as i64 + unit as i64) as i32;
    }
    // JS の Math.abs は double なので i32::MIN でも 2147483648 になる。
    to_base36((hash as i64).unsigned_abs())
}

/// ビューワーウィンドウのラベル。JS の viewerLabel() と同一。
pub fn viewer_label(path: &str) -> String {
    format!("viewer-{}", hash_code(path))
}

/// パスからファイル名を抽出する。JS の fileNameFromPath() と同一
/// （区切りは `/` と `\`、空なら "Viewer"）。
pub fn file_name_from_path(path: &str) -> String {
    let name = path.rsplit(['/', '\\']).next().unwrap_or("");
    if name.is_empty() {
        "Viewer".to_string()
    } else {
        name.to_string()
    }
}

fn to_base36(mut n: u64) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 {
        return "0".to_string();
    }
    let mut buf = Vec::new();
    while n > 0 {
        buf.push(DIGITS[(n % 36) as usize]);
        n /= 36;
    }
    buf.reverse();
    String::from_utf8(buf).expect("base36 digits are ASCII")
}

#[cfg(test)]
mod tests {
    use super::*;

    // ゴールデン値はすべて JS 実装（src/utils/windowLabel.ts）の実出力。
    #[test]
    fn hash_code_matches_js_output() {
        assert_eq!(hash_code("test"), "2487m");
        assert_eq!(hash_code("/path/to/file.zip"), "pwu1o8");
        assert_eq!(hash_code("a.zip"), "1i800k");
        assert_eq!(hash_code("b.zip"), "1irslx");
        assert_eq!(hash_code(""), "0");
        assert_eq!(hash_code("/home/user/comics/vol1.cbz"), "6noich");
    }

    #[test]
    fn hash_code_matches_js_output_for_japanese_path() {
        // UTF-16 コード単位で計算しないと一致しない
        assert_eq!(hash_code("/Users/山田/漫画/第1巻.zip"), "bs292c");
    }

    #[test]
    fn viewer_label_has_prefix_and_is_deterministic() {
        let path = "/home/user/comics/vol1.cbz";
        assert_eq!(viewer_label(path), "viewer-6noich");
        assert_eq!(viewer_label(path), viewer_label(path));
        assert_ne!(viewer_label("a.zip"), viewer_label("b.zip"));
    }

    #[test]
    fn file_name_from_path_variants() {
        assert_eq!(file_name_from_path("/home/user/comics/vol1.cbz"), "vol1.cbz");
        assert_eq!(
            file_name_from_path("C:\\Users\\test\\comics\\vol1.cbz"),
            "vol1.cbz"
        );
        assert_eq!(file_name_from_path("file.zip"), "file.zip");
        assert_eq!(file_name_from_path(""), "Viewer");
        assert_eq!(file_name_from_path("/dir/"), "Viewer");
    }
}
```

RED の確認: 実装が正しいかをテストが判定するため、まず**意図的に壊した状態**で失敗を確認する。`hash_code` の `s.encode_utf16()` を一時的に `s.chars().map(|c| c as u16)` に変えるのではなく、簡便に `to_base36` の `DIGITS` を大文字 `b"0123456789ABCDEF..."` にした状態で保存して Step 2 を実行し、失敗を確認してから戻す。

`src-tauri/src/lib.rs` の先頭のモジュール宣言に追加:

```rust
mod archive;
mod commands;
pub mod window_label;
```

- [ ] **Step 2: テストが失敗することを確認（RED）**

Run: `cd src-tauri && cargo test window_label`
Expected: FAIL（`hash_code_matches_js_output` が大文字 base36 のため不一致）

- [ ] **Step 3: 実装を正しい状態に戻す**

`DIGITS` を `b"0123456789abcdefghijklmnopqrstuvwxyz"` に戻す。

- [ ] **Step 4: テストが通ることを確認（GREEN）**

Run: `cd src-tauri && cargo test window_label`
Expected: PASS（4 テスト）

Run: `cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test`
Expected: すべて成功（既存テスト含む）

- [ ] **Step 5: コミット**

```bash
git add src-tauri/src/window_label.rs src-tauri/src/lib.rs
git commit -m "Add JS-compatible window label hashing in Rust"
```

---

### Task 2: launch.rs + コマンド + lib.rs 配線

**Files:**
- Create: `src-tauri/src/launch.rs`
- Create: `src-tauri/src/commands/launch.rs`
- Modify: `src-tauri/src/commands/mod.rs`（`pub mod launch;` を追加）
- Modify: `src-tauri/src/lib.rs`（モジュール追加・manage・invoke_handler・build/run 化・イベント処理）
- Modify: `src-tauri/Cargo.toml`（`percent-encoding = "2"` を `[dependencies]` に追加）

**Interfaces:**
- Consumes: Task 1 の `window_label::{viewer_label, file_name_from_path}`
- Produces:
  - `pub struct LaunchState { pub opened_via_file: AtomicBool }`（`app.manage()` で保持）
  - `pub fn is_supported_file(path: &Path) -> bool`（純関数・全 OS でテスト）
  - macOS 限定: `pub fn handle_run_event(app: &AppHandle, event: RunEvent)`
  - コマンド `was_opened_via_file() -> bool`（Task 3 のフロントが invoke）

- [ ] **Step 1: Cargo.toml に依存を追加**

`src-tauri/Cargo.toml` の `[dependencies]` に追加:

```toml
percent-encoding = "2"
```

- [ ] **Step 2: launch.rs を作成（純関数のテスト付き）**

`src-tauri/src/launch.rs`:

```rust
//! Finder（macOS）からのファイルオープン処理。
//! RunEvent::Opened / Reopen は macOS 限定 variant のため、
//! Tauri 依存の処理は #[cfg(target_os = "macos")] で囲み、
//! Linux CI（clippy -D warnings / test）でも警告ゼロを保つ。

use std::path::Path;
use std::sync::atomic::AtomicBool;

use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};

/// Finder 経由で起動されたかどうか（フロントの was_opened_via_file が参照）。
#[derive(Default)]
pub struct LaunchState {
    pub opened_via_file: AtomicBool,
}

/// mekuri が開ける拡張子（ASCII 大文字小文字無視）。
const SUPPORTED_EXTENSIONS: [&str; 5] = ["zip", "cbz", "rar", "cbr", "pdf"];

/// JS の encodeURIComponent と同じ非エスケープ集合
/// （英数字と - _ . ! ~ * ' ( ) 以外をパーセントエンコード）。
const URI_COMPONENT: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'!')
    .remove(b'~')
    .remove(b'*')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')');

pub fn is_supported_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            SUPPORTED_EXTENSIONS
                .iter()
                .any(|s| e.eq_ignore_ascii_case(s))
        })
        .unwrap_or(false)
}

fn encode_uri_component(s: &str) -> String {
    utf8_percent_encode(s, URI_COMPONENT).to_string()
}

#[cfg(target_os = "macos")]
mod macos {
    use std::path::PathBuf;
    use std::sync::atomic::Ordering;

    use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
    use tauri_plugin_store::StoreExt;

    use super::{encode_uri_component, is_supported_file, LaunchState};
    use crate::window_label::{file_name_from_path, viewer_label};

    // フロント src/utils/constants.ts と同値
    const DEFAULT_VIEWER_WIDTH: f64 = 1200.0;
    const DEFAULT_VIEWER_HEIGHT: f64 = 900.0;
    const VIEWER_MIN_WIDTH: f64 = 600.0;
    const VIEWER_MIN_HEIGHT: f64 = 400.0;

    /// macOS の RunEvent を処理する。lib.rs の run コールバックから呼ばれる。
    pub fn handle_run_event(app: &AppHandle, event: RunEvent) {
        match event {
            RunEvent::Opened { urls } => {
                app.state::<LaunchState>()
                    .opened_via_file
                    .store(true, Ordering::Relaxed);
                let paths: Vec<PathBuf> =
                    urls.iter().filter_map(|u| u.to_file_path().ok()).collect();
                open_files(app, paths);
            }
            RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                if !has_visible_windows {
                    show_main_window(app);
                }
            }
            _ => {}
        }
    }

    /// パスごとにビューワーウィンドウを開く。既存ラベルがあればフォーカスのみ。
    fn open_files(app: &AppHandle, paths: Vec<PathBuf>) {
        for path in paths {
            if !is_supported_file(&path) {
                eprintln!("mekuri: ignoring unsupported file: {}", path.display());
                continue;
            }
            let Some(path_str) = path.to_str() else {
                eprintln!("mekuri: ignoring non-UTF-8 path: {}", path.display());
                continue;
            };
            let label = viewer_label(path_str);
            if let Some(existing) = app.get_webview_window(&label) {
                let _ = existing.set_focus();
                continue;
            }
            let (width, height) = viewer_window_size(app);
            let url = format!("viewer.html?archive={}", encode_uri_component(path_str));
            let title = format!("{} - mekuri", file_name_from_path(path_str));
            let result = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
                .title(title)
                .inner_size(width, height)
                .min_inner_size(VIEWER_MIN_WIDTH, VIEWER_MIN_HEIGHT)
                .build();
            if let Err(e) = result {
                eprintln!("mekuri: failed to create viewer window: {e}");
            }
        }
    }

    /// settings.json の viewerSettings からサイズを読む（失敗時は既定値）。
    fn viewer_window_size(app: &AppHandle) -> (f64, f64) {
        if let Ok(store) = app.store("settings.json") {
            if let Some(v) = store.get("viewerSettings") {
                let w = v.get("width").and_then(|x| x.as_f64());
                let h = v.get("height").and_then(|x| x.as_f64());
                if let (Some(w), Some(h)) = (w, h) {
                    return (w, h);
                }
            }
        }
        (DEFAULT_VIEWER_WIDTH, DEFAULT_VIEWER_HEIGHT)
    }

    /// メインウィンドウを表示する。破棄済みなら tauri.conf.json の定義から再生成。
    fn show_main_window(app: &AppHandle) {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
            let _ = win.set_focus();
            return;
        }
        let Some(cfg) = app
            .config()
            .app
            .windows
            .iter()
            .find(|w| w.label == "main")
            .cloned()
        else {
            eprintln!("mekuri: no main window config found");
            return;
        };
        match WebviewWindowBuilder::from_config(app, &cfg) {
            Ok(builder) => match builder.build() {
                Ok(win) => {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                Err(e) => eprintln!("mekuri: failed to recreate main window: {e}"),
            },
            Err(e) => eprintln!("mekuri: invalid main window config: {e}"),
        }
    }
}

#[cfg(target_os = "macos")]
pub use macos::handle_run_event;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn supported_extensions_are_accepted_case_insensitively() {
        for name in [
            "a.zip", "a.cbz", "a.rar", "a.cbr", "a.pdf", "a.ZIP", "a.CbZ", "a.PDF",
        ] {
            assert!(is_supported_file(Path::new(name)), "{name}");
        }
    }

    #[test]
    fn unsupported_files_are_rejected() {
        for name in ["a.txt", "a.png", "a.avif", "archive", "a.", "a.zip.bak"] {
            assert!(!is_supported_file(Path::new(name)), "{name}");
        }
    }

    #[test]
    fn encode_uri_component_matches_js() {
        // JS: encodeURIComponent の実出力と一致させる
        assert_eq!(
            encode_uri_component("/Users/test/漫画 vol.1.zip"),
            "%2FUsers%2Ftest%2F%E6%BC%AB%E7%94%BB%20vol.1.zip"
        );
        assert_eq!(
            encode_uri_component("/a b/c'd(e)!~*.zip"),
            "%2Fa%20b%2Fc'd(e)!~*.zip"
        );
        assert_eq!(encode_uri_component("plain-name_1.2.pdf"), "plain-name_1.2.pdf");
    }
}
```

- [ ] **Step 3: コマンドを作成**

`src-tauri/src/commands/launch.rs`:

```rust
use std::sync::atomic::Ordering;

use tauri::State;

use crate::launch::LaunchState;

/// Finder のファイルオープン経由で起動されたかどうかを返す。
/// フロントはこれが true のときメインウィンドウの show() を抑制する。
#[tauri::command]
pub fn was_opened_via_file(state: State<'_, LaunchState>) -> bool {
    state.opened_via_file.load(Ordering::Relaxed)
}
```

`src-tauri/src/commands/mod.rs`:

```rust
pub mod archive;
pub mod fs;
pub mod launch;
```

- [ ] **Step 4: lib.rs を配線**

`src-tauri/src/lib.rs` 全体を以下に置き換え:

```rust
mod archive;
mod commands;
pub mod launch;
pub mod window_label;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(launch::LaunchState::default())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_directory,
            commands::fs::read_file_base64,
            commands::fs::trash_file,
            commands::fs::search_directory,
            commands::archive::list_archive_images,
            commands::archive::get_archive_image,
            commands::archive::analyze_archive_contents,
            commands::archive::extract_nested_archive,
            commands::launch::was_opened_via_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        #[cfg(target_os = "macos")]
        launch::handle_run_event(_app_handle, _event);
    });
}
```

（`_app_handle` / `_event` のアンダースコア名は Linux ビルドでの unused 警告を避けつつ macOS では使用するための意図的な命名）

- [ ] **Step 5: Rust 品質ゲート**

Run: `cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test`
Expected: すべて成功（launch の新テスト 3 件 + window_label 4 件 + 既存テスト）

- [ ] **Step 6: コミット**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/launch.rs src-tauri/src/commands/launch.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "Open viewer windows from macOS file-open events"
```

---

### Task 3: fileAssociations + フロント表示抑制 + ドキュメント

**Files:**
- Modify: `src-tauri/tauri.conf.json`（`bundle.fileAssociations` を追加）
- Modify: `src/App.tsx`（起動時の `show()` 抑制）
- Modify: `docs/architecture.md`（起動フローの節を追記）

**Interfaces:**
- Consumes: Task 2 のコマンド `was_opened_via_file`
- Produces: なし（最終タスク）

- [ ] **Step 1: tauri.conf.json に fileAssociations を追加**

`src-tauri/tauri.conf.json` の `"bundle"` セクションを以下に置き換え（`icon` は現状維持）:

```json
  "bundle": {
    "icon": [
      "icons/icon.icns",
      "icons/icon.ico",
      "icons/icon.png"
    ],
    "fileAssociations": [
      {
        "ext": ["zip", "cbz"],
        "name": "ZIP archive",
        "mimeType": "application/zip",
        "role": "Viewer"
      },
      {
        "ext": ["rar", "cbr"],
        "name": "RAR archive",
        "mimeType": "application/vnd.rar",
        "role": "Viewer"
      },
      {
        "ext": ["pdf"],
        "name": "PDF document",
        "mimeType": "application/pdf",
        "role": "Viewer"
      }
    ]
  },
```

- [ ] **Step 2: App.tsx の起動処理を変更**

`src/App.tsx` に import を追加:

```tsx
import { invoke } from "@tauri-apps/api/core";
```

「Load settings on mount」の useEffect（現在の 32〜49 行付近）を以下に置き換え:

```tsx
  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      const win = getCurrentWindow();
      // Finder のファイルオープン起動ではメインウィンドウを表示しない
      let openedViaFile = false;
      try {
        openedViaFile = await invoke<boolean>("was_opened_via_file");
      } catch (err) {
        console.error("Failed to query launch state:", err);
      }
      try {
        const settings = await getWindowSettings();
        setWidth(settings.treeColumnWidth);
        await win.setSize(new LogicalSize(settings.width, settings.height));
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        if (!openedViaFile) {
          await win.show();
        }
        setSettingsLoaded(true);
      }
    }
    loadSettings();
  }, [setWidth]);
```

- [ ] **Step 3: docs/architecture.md に節を追記**

`docs/architecture.md` の末尾に以下を追記:

```markdown
## Finder からのファイルオープン（macOS）

`bundle.fileAssociations`（zip/cbz/rar/cbr/pdf, role=Viewer）により、バンドルされた
.app の Info.plist に `CFBundleDocumentTypes` が生成され、Finder の
「このアプリケーションで開く」に mekuri が表示される（`pnpm tauri dev` では無効）。

フロー:

1. Finder で開くと macOS が Apple Event を配送し、Tauri の
   `RunEvent::Opened { urls }` が発火する（新規起動・起動中とも同じ）
2. `src-tauri/src/launch.rs` の `handle_run_event` が `LaunchState.opened_via_file`
   を立て、対応拡張子のみ `viewer.html?archive=<path>` のビューワーウィンドウを
   Rust から直接生成する。ウィンドウラベルは `src-tauri/src/window_label.rs`
   （JS `src/utils/windowLabel.ts` と同一アルゴリズム）で計算し、フォルダツリー
   経由と二重オープン防止を共有する
3. メインウィンドウのフロント（`src/App.tsx`）は起動時に `was_opened_via_file`
   コマンドを参照し、true なら `show()` を抑制する（ビューワーのみ起動）
4. 全ウィンドウを閉じた後の Dock クリックは `RunEvent::Reopen` で受け、
   メインウィンドウを表示（破棄済みなら設定から再生成）する

注意: `window_label.rs` と `windowLabel.ts` は同一のテストベクタを持ち、
アルゴリズムの乖離をテストで検知する。片方を変更する場合は必ず両方を更新する。
```

- [ ] **Step 4: 全品質ゲート**

```bash
pnpm format && pnpm lint && pnpm test && npx tsc --noEmit
cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test
```

Expected: すべて成功

- [ ] **Step 5: コミット**

```bash
git add src-tauri/tauri.conf.json src/App.tsx docs/architecture.md
git commit -m "Add file associations and viewer-only launch from Finder"
```

---

## 手動確認（マージ前・コントローラー/ユーザーが実施）

`pnpm tauri build` で .app を生成し、以下を確認する（fileAssociations はバンドルのみ有効）:

1. 未起動 → 対象ファイルを右クリック「このアプリケーションで開く」→ mekuri が候補に出る → ビューワーのみ表示される
2. 起動中 → 同操作でビューワーが追加で開く
3. 同一ファイル再オープン → 既存ビューワーにフォーカス
4. フォルダツリーから開いた同一ファイルを Finder からも開く → デデュープされる
5. 複数ファイル選択 → それぞれ開く
6. ビューワー全閉 → Dock クリック → メインウィンドウ表示
7. 通常起動（Dock/Spotlight）→ 従来どおりメインウィンドウ表示

## 完了後

1. `git push -u origin feat/finder-open-with`
2. `gh pr create` で `main` 向け PR を作成（本文に手動確認結果と「fileAssociations はバンドルのみ有効」の注意を記載）
3. CI（TypeScript + Rust/ubuntu）通過後にマージ
