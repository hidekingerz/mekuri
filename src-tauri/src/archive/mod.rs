mod rar;
mod zip;

use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];
const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "cbz", "rar", "cbr"];

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

/// List image entries in an archive, sorted by natural order.
pub fn list_images(archive_path: &str) -> Result<Vec<String>, String> {
    let path = Path::new(archive_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" | "cbz" => zip::list_images(archive_path),
        "rar" | "cbr" => rar::list_images(archive_path),
        _ => Err(format!("Unsupported archive format: .{ext}")),
    }
}

/// Analyze archive contents to determine if it contains images or nested archives.
pub fn analyze_contents(archive_path: &str) -> Result<ArchiveContents, String> {
    let path = Path::new(archive_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" | "cbz" => zip::analyze_contents(archive_path),
        "rar" | "cbr" => rar::analyze_contents(archive_path),
        _ => Err(format!("Unsupported archive format: .{ext}")),
    }
}

/// Extract a nested archive from a parent archive and return the path to the extracted file.
/// The extracted file is placed in a temporary directory that persists until app closes.
pub fn extract_nested_archive(parent_path: &str, nested_name: &str) -> Result<String, String> {
    let path = Path::new(parent_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" | "cbz" => zip::extract_nested_archive(parent_path, nested_name),
        "rar" | "cbr" => rar::extract_nested_archive(parent_path, nested_name),
        _ => Err(format!("Unsupported archive format: .{ext}")),
    }
}

/// Store a temp directory to keep it alive
pub fn store_temp_dir(dir: tempfile::TempDir) {
    if let Ok(mut dirs) = TEMP_DIRS.lock() {
        dirs.push(dir);
    }
}

/// Extract a single image from an archive and return it as a Base64-encoded data URL.
pub fn get_image_base64(archive_path: &str, entry_name: &str) -> Result<String, String> {
    let path = Path::new(archive_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" | "cbz" => zip::get_image_base64(archive_path, entry_name),
        "rar" | "cbr" => rar::get_image_base64(archive_path, entry_name),
        _ => Err(format!("Unsupported archive format: .{ext}")),
    }
}

/// Check if a filename has an image extension.
pub fn is_image_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    IMAGE_EXTENSIONS
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
        assert_eq!(mime_type_from_name("unknown.bmp"), "image/jpeg");
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
}
