//! JS (src/utils/windowLabel.ts) 互換のウィンドウラベル計算。
//! フォルダツリー経由（JS）と Finder 経由（Rust）で同一アーカイブの
//! ラベルを一致させ、二重オープン防止を共有するため、同一入力で
//! 同一出力になることが要件。テストベクタは JS 実装の実出力。

/// JS の hashCode() と同一出力を返す。
/// UTF-16 コード単位で `(hash << 5) - hash + unit` を i32 wrapping で畳み込み、
/// 絶対値を base36 文字列にする。
pub fn hash_code(s: &str) -> String {
    let mut hash: i32 = 0;
    for unit in s.encode_utf16() {
        // JS: hash = (hash << 5) - hash + char; hash |= 0;
        // (hash << 5) は int32 に切り詰め、その後の加減算は double（正確）で
        // 行われ |0 で int32 に戻る。i64 で計算し低位 32bit を取れば等価。
        let shifted = hash.wrapping_shl(5) as i64;
        hash = (shifted - hash as i64 + unit as i64) as i32;
    }
    // JS の Math.abs は double なので i32::MIN でも 2147483648 になる。
    to_base36((hash as i64).unsigned_abs())
}

/// ビューワーウィンドウのラベル。JS の viewerLabel() と同一。
pub fn viewer_label(path: &str) -> String {
    format!("viewer-{}", hash_code(path))
}

/// パスからファイル名を抽出する。JS の fileNameFromPath() と同一
/// （区切りは `/` と `\`、空なら "Viewer"）。
pub fn file_name_from_path(path: &str) -> String {
    let name = path.rsplit(['/', '\\']).next().unwrap_or("");
    if name.is_empty() {
        "Viewer".to_string()
    } else {
        name.to_string()
    }
}

fn to_base36(mut n: u64) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 {
        return "0".to_string();
    }
    let mut buf = Vec::new();
    while n > 0 {
        buf.push(DIGITS[(n % 36) as usize]);
        n /= 36;
    }
    buf.reverse();
    String::from_utf8(buf).expect("base36 digits are ASCII")
}

#[cfg(test)]
mod tests {
    use super::*;

    // ゴールデン値はすべて JS 実装（src/utils/windowLabel.ts）の実出力。
    #[test]
    fn hash_code_matches_js_output() {
        assert_eq!(hash_code("test"), "2487m");
        assert_eq!(hash_code("/path/to/file.zip"), "pwu1o8");
        assert_eq!(hash_code("a.zip"), "1i800k");
        assert_eq!(hash_code("b.zip"), "1irslx");
        assert_eq!(hash_code(""), "0");
        assert_eq!(hash_code("/home/user/comics/vol1.cbz"), "6noich");
    }

    #[test]
    fn hash_code_matches_js_output_for_japanese_path() {
        // UTF-16 コード単位で計算しないと一致しない
        assert_eq!(hash_code("/Users/山田/漫画/第1巻.zip"), "bs292c");
    }

    #[test]
    fn viewer_label_has_prefix_and_is_deterministic() {
        let path = "/home/user/comics/vol1.cbz";
        assert_eq!(viewer_label(path), "viewer-6noich");
        assert_eq!(viewer_label(path), viewer_label(path));
        assert_ne!(viewer_label("a.zip"), viewer_label("b.zip"));
    }

    #[test]
    fn file_name_from_path_variants() {
        assert_eq!(
            file_name_from_path("/home/user/comics/vol1.cbz"),
            "vol1.cbz"
        );
        assert_eq!(
            file_name_from_path("C:\\Users\\test\\comics\\vol1.cbz"),
            "vol1.cbz"
        );
        assert_eq!(file_name_from_path("file.zip"), "file.zip");
        assert_eq!(file_name_from_path(""), "Viewer");
        assert_eq!(file_name_from_path("/dir/"), "Viewer");
    }
}
