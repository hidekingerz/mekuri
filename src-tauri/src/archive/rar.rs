use super::{is_archive_file, is_image_file, mime_type_from_name, store_temp_dir, ArchiveContents};
use base64::Engine;
use std::io::Write;
use std::path::Path;
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

/// Analyze RAR archive contents to determine if it contains images or nested archives.
pub fn analyze_contents(archive_path: &str) -> Result<ArchiveContents, String> {
    let archive = Archive::new(archive_path)
        .open_for_listing()
        .map_err(|e| format!("Failed to open RAR archive: {e}"))?;

    let mut images: Vec<String> = Vec::new();
    let mut nested_archives: Vec<String> = Vec::new();

    for entry in archive {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.is_file() {
            continue;
        }
        let name = entry.filename.to_string_lossy().to_string();
        if name.contains("__MACOSX") {
            continue;
        }

        if is_image_file(&name) {
            images.push(name);
        } else if is_archive_file(&name) {
            nested_archives.push(name);
        }
    }

    // If we have images, return them
    if !images.is_empty() {
        images.sort_by(|a, b| natord::compare(a, b));
        return Ok(ArchiveContents::Images { names: images });
    }

    // If we have nested archives, return them
    if !nested_archives.is_empty() {
        nested_archives.sort_by(|a, b| natord::compare(a, b));
        return Ok(ArchiveContents::NestedArchives {
            names: nested_archives,
        });
    }

    Ok(ArchiveContents::Empty)
}

/// Extract a nested archive from a RAR file and return the path to the extracted file.
pub fn extract_nested_archive(parent_path: &str, nested_name: &str) -> Result<String, String> {
    let archive = Archive::new(parent_path)
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
                if name == nested_name {
                    let (data, _) = header
                        .read()
                        .map_err(|e| format!("Failed to read entry: {e}"))?;

                    // Create temp directory and write file
                    let temp_dir = tempfile::tempdir()
                        .map_err(|e| format!("Failed to create temp directory: {e}"))?;

                    let file_name = Path::new(&nested_name)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("archive");
                    let temp_path = temp_dir.path().join(file_name);

                    let mut file = std::fs::File::create(&temp_path)
                        .map_err(|e| format!("Failed to create temp file: {e}"))?;
                    file.write_all(&data)
                        .map_err(|e| format!("Failed to write temp file: {e}"))?;

                    let result = temp_path.to_string_lossy().to_string();

                    // Store temp dir to keep it alive
                    store_temp_dir(temp_dir);

                    return Ok(result);
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

    Err(format!("Nested archive not found: {nested_name}"))
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
