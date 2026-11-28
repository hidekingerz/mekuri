//! ファイル名の自然順。ページやファイルを、番号の小さい順・大文字小文字を区別しない順に並べる。

use std::cmp::Ordering;

/// 2 つの名前を自然順で比べる。
///
/// - 数字の並びは数値として比べる（`2` < `10`、`p8` < `p010`）。ゼロ埋めの有無は問わない
/// - 文字は大文字と小文字を区別せずに比べる（`a1` < `A2` < `a10`）
/// - そこまでで差が付かない名前どうしは、ゼロ埋めの少ないほう、次に文字コード順で並べる
///   （同じ入力はいつも同じ順になる）
pub fn compare(a: &str, b: &str) -> Ordering {
    let mut left = a.chars().peekable();
    let mut right = b.chars().peekable();
    // 数値や文字としては同じだが書き方が違った最初の箇所（ゼロ埋め、大文字小文字）
    let mut spelling = Ordering::Equal;

    loop {
        let (x, y) = match (left.peek().copied(), right.peek().copied()) {
            (None, None) => break,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => (x, y),
        };

        if x.is_ascii_digit() && y.is_ascii_digit() {
            let digits_left = take_digits(&mut left);
            let digits_right = take_digits(&mut right);
            let by_value = compare_numbers(&digits_left, &digits_right);
            if by_value != Ordering::Equal {
                return by_value;
            }
            spelling = spelling.then(digits_left.len().cmp(&digits_right.len()));
        } else {
            left.next();
            right.next();
            let ignoring_case = x.to_lowercase().cmp(y.to_lowercase());
            if ignoring_case != Ordering::Equal {
                return ignoring_case;
            }
            spelling = spelling.then(x.cmp(&y));
        }
    }

    spelling
}

/// 先頭から続く数字を取り出す。
fn take_digits(chars: &mut std::iter::Peekable<std::str::Chars<'_>>) -> String {
    let mut digits = String::new();
    while let Some(c) = chars.peek().copied().filter(char::is_ascii_digit) {
        digits.push(c);
        chars.next();
    }
    digits
}

/// 数字の並びを数値として比べる。桁数に上限は無い（整数型に変換しない）。
fn compare_numbers(a: &str, b: &str) -> Ordering {
    let a = a.trim_start_matches('0');
    let b = b.trim_start_matches('0');
    a.len().cmp(&b.len()).then_with(|| a.cmp(b))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted(names: &[&str]) -> Vec<String> {
        let mut names: Vec<String> = names.iter().map(|s| s.to_string()).collect();
        names.sort_by(|a, b| compare(a, b));
        names
    }

    #[test]
    fn orders_numbers_by_value() {
        assert_eq!(
            sorted(&["10.jpg", "2.jpg", "1.jpg"]),
            ["1.jpg", "2.jpg", "10.jpg"]
        );
        assert_eq!(
            sorted(&["page10.jpg", "page9.jpg", "page100.jpg"]),
            ["page9.jpg", "page10.jpg", "page100.jpg"]
        );
    }

    #[test]
    fn orders_zero_padded_numbers_by_value_too() {
        assert_eq!(
            sorted(&["10.jpg", "03.jpg", "1.jpg", "02.jpg"]),
            ["1.jpg", "02.jpg", "03.jpg", "10.jpg"]
        );
        assert_eq!(
            sorted(&["p010.jpg", "p9.jpg", "p8.jpg"]),
            ["p8.jpg", "p9.jpg", "p010.jpg"]
        );
        assert_eq!(
            sorted(&["page10", "page001", "page2", "page02"]),
            ["page001", "page2", "page02", "page10"]
        );
    }

    #[test]
    fn ignores_case() {
        assert_eq!(
            sorted(&["B2.png", "a10.JPG", "b1.jpg", "A2.jpg", "a1.jpg"]),
            ["a1.jpg", "A2.jpg", "a10.JPG", "b1.jpg", "B2.png"]
        );
    }

    #[test]
    fn orders_numbers_inside_folder_names() {
        assert_eq!(
            sorted(&["ch10/1.jpg", "ch2/10.jpg", "ch2/2.jpg", "ch1/3.jpg"]),
            ["ch1/3.jpg", "ch2/2.jpg", "ch2/10.jpg", "ch10/1.jpg"]
        );
    }

    #[test]
    fn handles_numbers_longer_than_any_integer_type() {
        let big = "9".repeat(40);
        let bigger = format!("1{}", "0".repeat(40));
        assert_eq!(compare(&big, &bigger), Ordering::Less);
        assert_eq!(compare(&bigger, &big), Ordering::Greater);
    }

    #[test]
    fn a_name_comes_before_a_longer_name_that_starts_with_it() {
        assert_eq!(sorted(&["vol1b", "vol1", "vol"]), ["vol", "vol1", "vol1b"]);
    }

    #[test]
    fn keeps_non_ascii_names_in_code_point_order() {
        assert_eq!(
            sorted(&["第2巻.zip", "第10巻.zip", "第1巻.zip", "あ.zip"]),
            ["あ.zip", "第1巻.zip", "第2巻.zip", "第10巻.zip"]
        );
    }

    #[test]
    fn is_a_total_order_for_names_that_differ_only_in_padding_or_case() {
        // 数値も文字も同じに見える名前どうしでも、順は 1 通りに決まる
        assert_eq!(sorted(&["01", "1", "001"]), ["1", "01", "001"]);
        assert_eq!(sorted(&["a.jpg", "A.jpg"]), ["A.jpg", "a.jpg"]);
        assert_eq!(compare("a b", "ab"), Ordering::Less);
        assert_eq!(compare("same", "same"), Ordering::Equal);

        let names = [
            "1", "01", "a1", "A1", "a01", "A01", "a 1", "a", "A", "", "10", "9",
        ];
        for x in names {
            for y in names {
                assert_eq!(compare(x, y), compare(y, x).reverse(), "{x:?} と {y:?}");
                for z in names {
                    if compare(x, y) != Ordering::Greater && compare(y, z) != Ordering::Greater {
                        assert_ne!(compare(x, z), Ordering::Greater, "{x:?} {y:?} {z:?}");
                    }
                }
            }
        }
    }
}
