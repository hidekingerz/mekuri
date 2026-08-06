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

/// JS の encodeURIComponent 互換エンコード（クロスプラットフォームの純関数）。
pub fn encode_uri_component(s: &str) -> String {
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
                // Tauri のネイティブ drag-drop 横取りを無効化しないと、
                // webview 内の HTML5 D&D（ファイル移動）が発火しない
                .disable_drag_drop_handler()
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
        assert_eq!(
            encode_uri_component("plain-name_1.2.pdf"),
            "plain-name_1.2.pdf"
        );
    }
}
