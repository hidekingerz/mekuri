use super::{is_image_file, mime_type_from_name};
use base64::Engine;
use std::io::Read;

/// List image file names inside a ZIP archive, sorted by natural order.
pub fn list_images(archive_path: &str) -> Result<Vec<String>, String> {
    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open archive: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {e}"))?;

    let mut names: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            let entry = archive.by_index_raw(i).ok()?;
            let name = entry.name().to_string();
            if is_image_file(&name) && !name.contains("__MACOSX") {
                // Use only the file name, not the full path inside archive
                Some(name)
            } else {
                None
            }
        })
        .collect();

    names.sort_by(|a, b| natord::compare(a, b));
    Ok(names)
}

/// Extract a single image from a ZIP archive and return it as a Base64 data URL.
pub fn get_image_base64(archive_path: &str, entry_name: &str) -> Result<String, String> {
    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open archive: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {e}"))?;

    let mut entry = archive
        .by_name(entry_name)
        .map_err(|e| format!("Entry not found: {e}"))?;

    let mut buf = Vec::with_capacity(entry.size() as usize);
    entry
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read entry: {e}"))?;

    let mime = mime_type_from_name(entry_name);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:{mime};base64,{b64}"))
}
