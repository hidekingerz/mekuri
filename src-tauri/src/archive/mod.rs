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
}
