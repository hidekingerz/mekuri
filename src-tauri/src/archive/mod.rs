mod rar;
mod zip;

use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use std::time::SystemTime;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "avif"];
const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "cbz", "rar", "cbr", "7z"];
const PDF_EXTENSIONS: &[&str] = &["pdf"];

/// Supported archive format categories.
enum ArchiveFormat {
    Zip,
    Rar,
}

/// Detect the archive format from a file path's extension.
fn detect_format(archive_path: &str) -> Result<ArchiveFormat, String> {
    let ext = Path::new(archive_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" | "cbz" => Ok(ArchiveFormat::Zip),
        "rar" | "cbr" => Ok(ArchiveFormat::Rar),
        _ => Err(format!("Unsupported archive format: .{ext}")),
    }
}

/// Result of analyzing archive contents
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum ArchiveContents {
    /// Archive contains images directly
    Images { names: Vec<String> },
    /// Archive contains nested archives
    NestedArchives { names: Vec<String> },
    /// Archive is empty or has no relevant content
    Empty,
}

/// Global storage for extracted temporary directories
/// This keeps temp directories alive until the app closes
static TEMP_DIRS: Mutex<Vec<tempfile::TempDir>> = Mutex::new(Vec::new());

/// 展開したネストアーカイブがどの親のどの中身かを表す。親の更新日時とサイズも持ち、
/// 同じパスに別のファイルが置き直されたら別物として扱う
#[derive(PartialEq)]
struct ExtractionSource {
    parent: String,
    nested: String,
    modified: Option<SystemTime>,
    len: u64,
}

impl ExtractionSource {
    /// 親の情報を読めなければ None（展開のほうが、その失敗を報告する）
    fn of(parent_path: &str, nested_name: &str) -> Option<Self> {
        let metadata = std::fs::metadata(parent_path).ok()?;
        Some(Self {
            parent: parent_path.to_string(),
            nested: nested_name.to_string(),
            modified: metadata.modified().ok(),
            len: metadata.len(),
        })
    }
}

/// 展開済みのネストアーカイブと、その展開先。同じものを開くたびに展開し直すと、
/// 一時ディレクトリがアプリ終了まで増え続けるので、変わっていなければ使い回す
static EXTRACTED: Mutex<Vec<(ExtractionSource, String)>> = Mutex::new(Vec::new());

/// source の展開先がまだ残っていれば、そのパス。
fn extracted_path(source: &ExtractionSource) -> Option<String> {
    let extracted = EXTRACTED.lock().ok()?;
    extracted
        .iter()
        .find(|(known, path)| known == source && Path::new(path).is_file())
        .map(|(_, path)| path.clone())
}

fn remember_extraction(source: ExtractionSource, path: String) {
    if let Ok(mut extracted) = EXTRACTED.lock() {
        // 同じ親・同じ名前の古い控えは、親が置き直されたか、展開先が消えたもの
        extracted
            .retain(|(known, _)| known.parent != source.parent || known.nested != source.nested);
        extracted.push((source, path));
    }
}

/// List image entries in an archive, sorted by natural order.
pub fn list_images(archive_path: &str) -> Result<Vec<String>, String> {
    match detect_format(archive_path)? {
        ArchiveFormat::Zip => zip::list_images(archive_path),
        ArchiveFormat::Rar => rar::list_images(archive_path),
    }
}

/// Analyze archive contents to determine if it contains images or nested archives.
pub fn analyze_contents(archive_path: &str) -> Result<ArchiveContents, String> {
    match detect_format(archive_path)? {
        ArchiveFormat::Zip => zip::analyze_contents(archive_path),
        ArchiveFormat::Rar => rar::analyze_contents(archive_path),
    }
}

/// Extract a nested archive from a parent archive and return the path to the extracted file.
/// The extracted file is placed in a temporary directory that persists until app closes.
/// 親が変わっておらず、前に展開したものが残っていれば、展開し直さずにそのパスを返す。
pub fn extract_nested_archive(parent_path: &str, nested_name: &str) -> Result<String, String> {
    let source = ExtractionSource::of(parent_path, nested_name);
    if let Some(path) = source.as_ref().and_then(extracted_path) {
        return Ok(path);
    }

    let path = match detect_format(parent_path)? {
        ArchiveFormat::Zip => zip::extract_nested_archive(parent_path, nested_name),
        ArchiveFormat::Rar => rar::extract_nested_archive(parent_path, nested_name),
    }?;
    if let Some(source) = source {
        remember_extraction(source, path.clone());
    }
    Ok(path)
}

/// Store a temp directory to keep it alive
pub fn store_temp_dir(dir: tempfile::TempDir) {
    if let Ok(mut dirs) = TEMP_DIRS.lock() {
        dirs.push(dir);
    }
}

/// Extract a single image from an archive and return it as a Base64-encoded data URL.
pub fn get_image_base64(archive_path: &str, entry_name: &str) -> Result<String, String> {
    match detect_format(archive_path)? {
        ArchiveFormat::Zip => zip::get_image_base64(archive_path, entry_name),
        ArchiveFormat::Rar => rar::get_image_base64(archive_path, entry_name),
    }
}

/// Check if a filename has an image extension.
pub fn is_image_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    IMAGE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
}

/// Check if a filename has a PDF extension.
pub fn is_pdf_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    PDF_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
}

/// Check if a filename has an archive extension.
pub fn is_archive_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    ARCHIVE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
}

/// Guess MIME type from file extension.
pub fn mime_type_from_name(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".avif") {
        "image/avif"
    } else {
        "image/jpeg"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_image_file() {
        assert!(is_image_file("photo.jpg"));
        assert!(is_image_file("photo.JPEG"));
        assert!(is_image_file("image.png"));
        assert!(is_image_file("image.webp"));
        assert!(is_image_file("anim.gif"));
        assert!(is_image_file("photo.avif"));
        assert!(!is_image_file("readme.txt"));
        assert!(!is_image_file("archive.zip"));
        assert!(!is_image_file("noext"));
    }

    #[test]
    fn test_mime_type_from_name() {
        assert_eq!(mime_type_from_name("photo.jpg"), "image/jpeg");
        assert_eq!(mime_type_from_name("photo.jpeg"), "image/jpeg");
        assert_eq!(mime_type_from_name("image.png"), "image/png");
        assert_eq!(mime_type_from_name("image.PNG"), "image/png");
        assert_eq!(mime_type_from_name("image.webp"), "image/webp");
        assert_eq!(mime_type_from_name("anim.gif"), "image/gif");
        assert_eq!(mime_type_from_name("photo.avif"), "image/avif");
        assert_eq!(mime_type_from_name("unknown.bmp"), "image/jpeg");
    }

    #[test]
    fn test_is_pdf_file() {
        assert!(is_pdf_file("document.pdf"));
        assert!(is_pdf_file("document.PDF"));
        assert!(is_pdf_file("path/to/file.pdf"));
        assert!(!is_pdf_file("readme.txt"));
        assert!(!is_pdf_file("archive.zip"));
        assert!(!is_pdf_file("noext"));
    }

    #[test]
    fn test_unsupported_archive_format() {
        let result = list_images("test.tar");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported"));
    }

    #[test]
    fn test_nonexistent_archive() {
        let result = list_images("nonexistent.zip");
        assert!(result.is_err());
    }

    #[test]
    fn test_nonexistent_rar_archive() {
        let result = list_images("nonexistent.rar");
        assert!(result.is_err());
    }

    #[test]
    fn test_cbr_dispatches_to_rar() {
        let result = list_images("nonexistent.cbr");
        assert!(result.is_err());
        // Should not say "Unsupported" — it should be a file-not-found error
        assert!(!result.unwrap_err().contains("Unsupported"));
    }

    #[test]
    fn test_rar_get_image_nonexistent() {
        let result = get_image_base64("nonexistent.rar", "image.jpg");
        assert!(result.is_err());
    }

    /// dir に、inner.zip と other.zip（どちらも pages の画像を持つ）を入れた outer.zip を作る
    fn write_outer_zip(dir: &Path, pages: &[&str]) -> String {
        use std::io::Write;
        let options = ::zip::write::SimpleFileOptions::default();

        let mut inner = ::zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        for page in pages {
            inner.start_file(*page, options).unwrap();
            inner.write_all(b"image").unwrap();
        }
        let inner_bytes = inner.finish().unwrap().into_inner();

        let outer_path = dir.join("outer.zip");
        let mut outer = ::zip::ZipWriter::new(std::fs::File::create(&outer_path).unwrap());
        for name in ["inner.zip", "other.zip"] {
            outer.start_file(name, options).unwrap();
            outer.write_all(&inner_bytes).unwrap();
        }
        outer.finish().unwrap();
        outer_path.to_string_lossy().to_string()
    }

    #[test]
    fn test_extract_nested_archive_reuses_the_extraction_of_an_unchanged_parent() {
        let dir = tempfile::tempdir().unwrap();
        let outer = write_outer_zip(dir.path(), &["1.jpg"]);

        let first = extract_nested_archive(&outer, "inner.zip").unwrap();
        let second = extract_nested_archive(&outer, "inner.zip").unwrap();

        assert_eq!(first, second);
        assert_eq!(list_images(&second).unwrap(), ["1.jpg"]);
    }

    #[test]
    fn test_extract_nested_archive_keeps_each_nested_archive_apart() {
        let dir = tempfile::tempdir().unwrap();
        let outer = write_outer_zip(dir.path(), &["1.jpg"]);

        let inner = extract_nested_archive(&outer, "inner.zip").unwrap();
        let other = extract_nested_archive(&outer, "other.zip").unwrap();

        assert_ne!(inner, other);
        assert!(other.ends_with("other.zip"));
    }

    #[test]
    fn test_extract_nested_archive_extracts_again_when_the_parent_was_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let outer = write_outer_zip(dir.path(), &["1.jpg"]);
        let first = extract_nested_archive(&outer, "inner.zip").unwrap();

        // 同じパスに、中身の違うファイルが置き直された
        write_outer_zip(dir.path(), &["1.jpg", "2.jpg"]);
        let second = extract_nested_archive(&outer, "inner.zip").unwrap();

        assert_ne!(first, second);
        assert_eq!(list_images(&second).unwrap(), ["1.jpg", "2.jpg"]);
    }

    #[test]
    fn test_extract_nested_archive_extracts_again_when_the_extracted_file_is_gone() {
        let dir = tempfile::tempdir().unwrap();
        let outer = write_outer_zip(dir.path(), &["1.jpg"]);
        let first = extract_nested_archive(&outer, "inner.zip").unwrap();

        // OS の一時フォルダの掃除などで、展開先が消えた
        std::fs::remove_file(&first).unwrap();
        let second = extract_nested_archive(&outer, "inner.zip").unwrap();

        assert_eq!(list_images(&second).unwrap(), ["1.jpg"]);
    }

    #[test]
    fn test_extract_nested_archive_reports_a_missing_parent_every_time() {
        for _ in 0..2 {
            assert!(extract_nested_archive("/no/such/outer.zip", "inner.zip").is_err());
        }
    }
}
