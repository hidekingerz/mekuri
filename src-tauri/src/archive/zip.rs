use super::{is_archive_file, is_image_file, mime_type_from_name, store_temp_dir, ArchiveContents};
use crate::natural_order;
use base64::Engine;
use std::io::{Read, Write};
use std::path::Path;

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

    names.sort_by(|a, b| natural_order::compare(a, b));
    Ok(names)
}

/// Analyze ZIP archive contents to determine if it contains images or nested archives.
pub fn analyze_contents(archive_path: &str) -> Result<ArchiveContents, String> {
    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open archive: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {e}"))?;

    let mut images: Vec<String> = Vec::new();
    let mut nested_archives: Vec<String> = Vec::new();

    for i in 0..archive.len() {
        let entry = match archive.by_index_raw(i) {
            Ok(e) => e,
            Err(_) => continue,
        };
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
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
        images.sort_by(|a, b| natural_order::compare(a, b));
        return Ok(ArchiveContents::Images { names: images });
    }

    // If we have nested archives, return them
    if !nested_archives.is_empty() {
        nested_archives.sort_by(|a, b| natural_order::compare(a, b));
        return Ok(ArchiveContents::NestedArchives {
            names: nested_archives,
        });
    }

    Ok(ArchiveContents::Empty)
}

/// Extract a nested archive from a ZIP file and return the path to the extracted file.
pub fn extract_nested_archive(parent_path: &str, nested_name: &str) -> Result<String, String> {
    let file =
        std::fs::File::open(parent_path).map_err(|e| format!("Failed to open archive: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {e}"))?;

    let mut entry = archive
        .by_name(nested_name)
        .map_err(|e| format!("Entry not found: {e}"))?;

    let mut buf = Vec::with_capacity(entry.size() as usize);
    entry
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read entry: {e}"))?;

    // Create temp directory and write file
    let temp_dir =
        tempfile::tempdir().map_err(|e| format!("Failed to create temp directory: {e}"))?;

    let file_name = Path::new(nested_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("archive");
    let temp_path = temp_dir.path().join(file_name);

    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {e}"))?;
    file.write_all(&buf)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;

    let result = temp_path.to_string_lossy().to_string();

    // Store temp dir to keep it alive
    store_temp_dir(temp_dir);

    Ok(result)
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

    /// 桁数の違う番号・フォルダ入りの名前を、格納順でも文字コード順でもなく自然順で返す。
    const UNSORTED_PAGES: &[(&str, &[u8])] = &[
        ("10.jpg", b"x"),
        ("ch10/1.jpg", b"x"),
        ("2.jpg", b"x"),
        ("ch2/10.jpg", b"x"),
        ("1.jpg", b"x"),
        ("ch2/2.jpg", b"x"),
        ("__MACOSX/._1.jpg", b"macos metadata"),
        ("notes.txt", b"not an image"),
    ];
    const NATURAL_ORDER: &[&str] = &[
        "1.jpg",
        "2.jpg",
        "10.jpg",
        "ch2/2.jpg",
        "ch2/10.jpg",
        "ch10/1.jpg",
    ];

    #[test]
    fn test_list_images_uses_natural_order() {
        let zip_file = create_test_zip(UNSORTED_PAGES);

        let result = list_images(zip_file.path().to_str().unwrap()).unwrap();
        assert_eq!(result, NATURAL_ORDER);
    }

    #[test]
    fn test_analyze_contents_lists_images_in_natural_order() {
        let zip_file = create_test_zip(UNSORTED_PAGES);

        let result = analyze_contents(zip_file.path().to_str().unwrap()).unwrap();
        match result {
            ArchiveContents::Images { names } => assert_eq!(names, NATURAL_ORDER),
            other => panic!("expected images, got {other:?}"),
        }
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

    #[test]
    fn test_pages_with_mixed_padding_and_case_are_in_reading_order() {
        let zip_file = create_test_zip(&[
            ("p010.jpg", b"x"),
            ("P9.jpg", b"x"),
            ("p8.jpg", b"x"),
            ("p02.jpg", b"x"),
            ("p1.jpg", b"x"),
        ]);
        let expected = ["p1.jpg", "p02.jpg", "p8.jpg", "P9.jpg", "p010.jpg"];
        let path = zip_file.path().to_str().unwrap();

        assert_eq!(list_images(path).unwrap(), expected);
        match analyze_contents(path).unwrap() {
            ArchiveContents::Images { names } => assert_eq!(names, expected),
            other => panic!("expected images, got {other:?}"),
        }
    }
}
