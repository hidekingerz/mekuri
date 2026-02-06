use super::{is_image_file, mime_type_from_name};
use base64::Engine;
use unrar::Archive;

/// List image file names inside a RAR archive, sorted by natural order.
pub fn list_images(archive_path: &str) -> Result<Vec<String>, String> {
    let archive = Archive::new(archive_path)
        .open_for_listing()
        .map_err(|e| format!("Failed to open RAR archive: {e}"))?;

    let mut names: Vec<String> = archive
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.filename.to_string_lossy().to_string();
            if entry.is_file() && is_image_file(&name) && !name.contains("__MACOSX") {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    names.sort_by(|a, b| natord::compare(a, b));
    Ok(names)
}

/// Extract a single image from a RAR archive and return it as a Base64 data URL.
pub fn get_image_base64(archive_path: &str, entry_name: &str) -> Result<String, String> {
    let archive = Archive::new(archive_path)
        .open_for_processing()
        .map_err(|e| format!("Failed to open RAR archive: {e}"))?;

    let mut cursor = Some(archive);

    while let Some(open) = cursor {
        let header = open
            .read_header()
            .map_err(|e| format!("Failed to read RAR header: {e}"))?;

        match header {
            Some(header) => {
                let name = header.entry().filename.to_string_lossy().to_string();
                if name == entry_name {
                    let (data, _) = header
                        .read()
                        .map_err(|e| format!("Failed to read entry: {e}"))?;
                    let mime = mime_type_from_name(entry_name);
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                    return Ok(format!("data:{mime};base64,{b64}"));
                }
                // Skip this entry
                let next = header
                    .skip()
                    .map_err(|e| format!("Failed to skip entry: {e}"))?;
                cursor = Some(next);
            }
            None => break,
        }
    }

    Err(format!("Entry not found: {entry_name}"))
}
