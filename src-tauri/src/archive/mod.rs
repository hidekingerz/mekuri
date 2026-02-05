mod zip;

use std::path::Path;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];

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
        _ => Err(format!("Unsupported archive format: .{ext}")),
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
