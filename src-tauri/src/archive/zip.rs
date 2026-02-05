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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Create a temporary ZIP file with the given entries for testing.
    fn create_test_zip(entries: &[(&str, &[u8])]) -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut writer = zip::ZipWriter::new(std::io::BufWriter::new(file.as_file()));
        let options = zip::write::SimpleFileOptions::default();

        for (name, data) in entries {
            writer.start_file(*name, options).unwrap();
            writer.write_all(data).unwrap();
        }
        writer.finish().unwrap();
        file
    }

    #[test]
    fn test_list_images_filters_and_sorts() {
        let zip_file = create_test_zip(&[
            ("page03.jpg", b"fake-jpg-3"),
            ("page01.jpg", b"fake-jpg-1"),
            ("readme.txt", b"not an image"),
            ("page02.png", b"fake-png-2"),
            ("__MACOSX/._page01.jpg", b"macos metadata"),
        ]);

        let result = list_images(zip_file.path().to_str().unwrap()).unwrap();
        assert_eq!(result, vec!["page01.jpg", "page02.png", "page03.jpg"]);
    }

    #[test]
    fn test_list_images_empty_zip() {
        let zip_file = create_test_zip(&[("readme.txt", b"no images here")]);

        let result = list_images(zip_file.path().to_str().unwrap()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_get_image_base64_returns_data_url() {
        let png_data = b"fake-png-data";
        let zip_file = create_test_zip(&[("image.png", png_data)]);

        let result = get_image_base64(zip_file.path().to_str().unwrap(), "image.png").unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        // Verify the base64 content decodes back to original
        let b64_part = result.strip_prefix("data:image/png;base64,").unwrap();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(b64_part)
            .unwrap();
        assert_eq!(decoded, png_data);
    }

    #[test]
    fn test_get_image_base64_entry_not_found() {
        let zip_file = create_test_zip(&[("image.png", b"data")]);

        let result = get_image_base64(zip_file.path().to_str().unwrap(), "nonexistent.png");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Entry not found"));
    }
}
