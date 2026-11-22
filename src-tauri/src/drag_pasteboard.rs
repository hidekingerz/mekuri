//! Finder などアプリ外からドロップされたファイルのパスを、ドラッグ用ペーストボードから読む。
//!
//! メインウィンドウは HTML5 の D&D を使うため Tauri のネイティブ drag-drop を無効化している。
//! その状態でも WebView の drop イベントは発火するが、`File` からは絶対パスが取れない。
//! ドロップ中はドラッグ用ペーストボードにファイル URL が残っているので、それを読む。

use std::path::PathBuf;

/// 現在のドラッグ用ペーストボードにあるファイルのパス。macOS 以外では常に空。
pub fn dragged_file_paths() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSPasteboard, NSPasteboardNameDrag};
        let pasteboard = NSPasteboard::pasteboardWithName(unsafe { NSPasteboardNameDrag });
        macos::file_paths_on(&pasteboard)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Vec::new()
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypeFileURL};
    use objc2_foundation::NSURL;
    use std::path::PathBuf;

    /// ペーストボードの各項目のファイル URL をパスに直す。
    /// Finder はファイル参照 URL（file:///.file/id=...）を載せるので、通常のパスへ解決してから読む。
    pub(super) fn file_paths_on(pasteboard: &NSPasteboard) -> Vec<PathBuf> {
        let Some(items) = pasteboard.pasteboardItems() else {
            return Vec::new();
        };
        items
            .iter()
            .filter_map(|item| {
                let url_string = item.stringForType(unsafe { NSPasteboardTypeFileURL })?;
                let url = NSURL::URLWithString(&url_string)?;
                let path = url.filePathURL()?.path()?;
                Some(PathBuf::from(path.to_string()))
            })
            .collect()
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use objc2::rc::Retained;
        use objc2::runtime::ProtocolObject;
        use objc2_app_kit::{NSPasteboardItem, NSPasteboardWriting};
        use objc2_foundation::{NSArray, NSString};

        fn pasteboard_with(urls: &[Retained<NSString>]) -> Retained<NSPasteboard> {
            let pasteboard = NSPasteboard::pasteboardWithUniqueName();
            pasteboard.clearContents();
            let items: Vec<Retained<ProtocolObject<dyn NSPasteboardWriting>>> = urls
                .iter()
                .map(|url| {
                    let item = NSPasteboardItem::new();
                    item.setString_forType(url, unsafe { NSPasteboardTypeFileURL });
                    ProtocolObject::from_retained(item)
                })
                .collect();
            assert!(pasteboard.writeObjects(&NSArray::from_retained_slice(&items)));
            pasteboard
        }

        #[test]
        fn reads_percent_encoded_file_urls() {
            let pasteboard = pasteboard_with(&[
                NSString::from_str("file:///tmp/a%20b.zip"),
                NSString::from_str("file:///tmp/%E6%BC%AB%E7%94%BB.cbz"),
            ]);
            assert_eq!(
                file_paths_on(&pasteboard),
                vec![
                    PathBuf::from("/tmp/a b.zip"),
                    PathBuf::from("/tmp/漫画.cbz")
                ]
            );
        }

        #[test]
        fn resolves_file_reference_urls() {
            let dir = tempfile::tempdir().unwrap();
            let file = dir.path().canonicalize().unwrap().join("book.zip");
            std::fs::write(&file, b"x").unwrap();
            let reference = NSURL::fileURLWithPath(&NSString::from_str(file.to_str().unwrap()))
                .fileReferenceURL()
                .unwrap();
            let reference_string = reference.absoluteString().unwrap();
            assert!(reference_string
                .to_string()
                .starts_with("file:///.file/id="));

            let pasteboard = pasteboard_with(&[reference_string]);
            assert_eq!(file_paths_on(&pasteboard), vec![file]);
        }

        #[test]
        fn skips_items_without_file_url() {
            let pasteboard = pasteboard_with(&[NSString::from_str("file:///tmp/a.zip")]);
            let text_only = NSPasteboardItem::new();
            text_only.setString_forType(&NSString::from_str("not a file"), unsafe {
                objc2_app_kit::NSPasteboardTypeString
            });
            let items: Vec<Retained<ProtocolObject<dyn NSPasteboardWriting>>> =
                vec![ProtocolObject::from_retained(text_only)];
            assert!(pasteboard.writeObjects(&NSArray::from_retained_slice(&items)));
            assert_eq!(
                file_paths_on(&pasteboard),
                vec![PathBuf::from("/tmp/a.zip")]
            );
        }

        #[test]
        fn returns_nothing_for_an_empty_pasteboard() {
            let pasteboard = NSPasteboard::pasteboardWithUniqueName();
            pasteboard.clearContents();
            assert!(file_paths_on(&pasteboard).is_empty());
        }
    }
}
