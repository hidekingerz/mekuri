# Finder「このアプリケーションで開く」対応 設計

- 日付: 2026-07-26
- 対象ブランチ: `feat/finder-open-with`（`main` ベース）

## 背景と目的

macOS の Finder でアーカイブ/PDF を右クリックしても「このアプリケーションで開く」に
mekuri が表示されない。ファイル関連付けを宣言して候補に表示させ、選択したファイルを
メインウィンドウを経由せずビューワーで直接開けるようにする。

## 要件

- 対象拡張子: `zip` / `cbz` / `rar` / `cbr` / `pdf`（大文字小文字を区別しない）
- Finder からの**新規起動**時はメインウィンドウ（フォルダツリー）を表示せず、
  ビューワーのみ開く
- アプリ**起動中**に Finder から開いた場合は、既存ウィンドウはそのままビューワーを
  追加で開く
- 同一ファイルを再度開いた場合は新規ウィンドウを作らず既存ビューワーにフォーカスする
  （フォルダツリー経由で開いたウィンドウとも相互にデデュープされること）
- 複数ファイル選択で開いた場合はファイルごとにビューワーを開く
- ビューワーのみ起動 → 全ウィンドウを閉じた後に Dock アイコンをクリックしたら
  メインウィンドウを表示する
- ファイル関連付けはバンドル済み `.app` でのみ有効（`pnpm tauri dev` では Finder に
  表示されない）。動作確認は `pnpm tauri build` の成果物で行う

## 全体構成（案 A: Rust がビューワーを直接生成）

macOS ではファイルオープンは Apple Event として届き、Tauri v2 では
`RunEvent::Opened { urls }` で受け取れる（新規起動・起動中とも同一イベント）。
Rust 側でこれを処理し、`WebviewWindowBuilder` でビューワーウィンドウを直接生成する。
hidden なメインウィンドウの webview には依存しない。

## 変更点

### 1. `src-tauri/tauri.conf.json` — ファイル関連付け宣言

`bundle.fileAssociations` に以下の 3 エントリを追加（すべて `role: "Viewer"`）:

| ext | name | mimeType |
|-----|------|----------|
| `zip`, `cbz` | ZIP archive | `application/zip` |
| `rar`, `cbr` | RAR archive | `application/vnd.rar` |
| `pdf` | PDF document | `application/pdf` |

ビルド時に Info.plist の `CFBundleDocumentTypes` に変換される。

### 2. `src-tauri/src/window_label.rs`（新規・純ロジック）

JS の `src/utils/windowLabel.ts` と互換のラベル計算を提供する。

```rust
pub fn hash_code(s: &str) -> String;      // JS hashCode() と同一出力
pub fn viewer_label(path: &str) -> String; // "viewer-" + hash_code(path)
pub fn file_name_from_path(path: &str) -> String; // ファイル名抽出（"Viewer" フォールバック）
```

互換性の要点:

- JS は `charCodeAt`（UTF-16 コード単位）で計算するため、Rust も
  `s.encode_utf16()` でイテレートする（日本語パスで一致させるため）
- ハッシュ演算は i32 の wrapping（`(hash << 5) - hash + char`）
- JS の `Math.abs` は double なので i32 範囲を超えられる。Rust は `i64` に
  広げてから絶対値を取り base36 文字列化する（`i32::MIN` エッジ対応）
- JS 側 `windowLabel.test.ts` と同一のテストベクタ（ASCII・日本語・ラベル形式）を
  Rust 単体テストに持ち、両実装の乖離を検知する

### 3. `src-tauri/src/launch.rs`（新規・Tauri 依存の配線）

- `pub struct LaunchState { opened_via_file: AtomicBool }` を `app.manage()` で保持
- `pub fn open_files(app: &AppHandle, paths: Vec<PathBuf>)`:
  1. 拡張子が対象 5 種（ASCII 大文字小文字無視）でなければ無視
  2. `viewer_label()` でラベル計算。`app.get_webview_window(&label)` が存在すれば
     `set_focus()` して終了
  3. なければ `WebviewWindowBuilder::new(app, label, WebviewUrl::App("viewer.html?archive=<enc>"))`
     で生成。タイトルは `{ファイル名} - mekuri`
- クエリエンコードは `percent-encoding` クレートで `encodeURIComponent` 互換の
  AsciiSet（英数字と `- _ . ! ~ * ' ( )` 以外をエンコード）を定義
- ウィンドウサイズ: `tauri_plugin_store::StoreExt` で `settings.json` の
  `viewerSettings.width` / `.height` を読む。取得できなければ既定値
  1200×900（フロント `DEFAULT_VIEWER_WIDTH/HEIGHT` と同値）。
  min サイズは 600×400（`VIEWER_MIN_WIDTH/HEIGHT` と同値）

### 4. `src-tauri/src/lib.rs` — イベント配線

`.run(context)` を `.build(context)` + `.run(callback)` に変更し、macOS 限定
（`#[cfg(target_os = "macos")]`）で処理する:

- `RunEvent::Opened { urls }`: `LaunchState.opened_via_file` を true にし、
  `file://` URL をパスに変換して `launch::open_files()` を呼ぶ
- `RunEvent::Reopen { has_visible_windows, .. }`: `has_visible_windows == false`
  のときメインウィンドウ（label `"main"`）を `show()` + `set_focus()`。
  メインウィンドウが既に破棄されている場合（ユーザーが閉じた後）は
  `WebviewWindowBuilder::from_config` で tauri.conf.json の定義から再生成して表示する

### 5. 新コマンド `commands/launch.rs`

```rust
#[tauri::command]
pub fn was_opened_via_file(state: State<LaunchState>) -> bool;
```

`invoke_handler` に登録する。CLAUDE.md の層規約どおり、コマンドは薄い IPC
エンドポイントに留める。

### 6. `src/App.tsx` — メインウィンドウ表示の抑制

起動時初期化で `win.show()` の前に `invoke<boolean>("was_opened_via_file")` を
呼び、true の場合は `show()` をスキップする（他の初期化はそのまま実行）。

タイミングについて: macOS の odoc Apple Event は run loop 開始直後に配送され、
フロントの settings 読込→`show()` より早い。最悪ケース（イベントが遅れた場合）でも
メインウィンドウが一緒に表示されるだけで、機能は損なわれない。

## エラー処理

- 非対象拡張子・`to_file_path()` 失敗 → 無視（ログのみ）
- ウィンドウ生成失敗 → `eprintln!` でログし継続（アプリはクラッシュさせない）
- store 読込失敗 → 既定サイズにフォールバック

## テスト

- Rust 単体テスト（`cargo test`）:
  - `window_label.rs`: JS テストと同一ベクタでの `hash_code` / `viewer_label` /
    `file_name_from_path`、日本語パス、同一入力→同一ラベル
  - `launch.rs` の拡張子判定（純関数に切り出してテスト）
- フロント: 既存テストの回帰（`pnpm test`）。App.tsx の変更はロジックが薄いため
  手動確認でカバー
- 手動確認（`pnpm tauri build` の .app で実施）:
  1. 未起動 → 右クリック「このアプリケーションで開く」→ ビューワーのみ表示される
  2. 起動中 → 同操作でビューワーが追加で開く
  3. 同一ファイル再オープン → 既存ビューワーにフォーカス
  4. フォルダツリーから開いたファイルを Finder からも開く → デデュープされる
  5. 複数ファイル選択 → それぞれ開く
  6. ビューワー全閉 → Dock クリック → メインウィンドウ表示
  7. 通常起動（Dock/Spotlight）→ 従来どおりメインウィンドウ表示

## ドキュメント

- `docs/architecture.md` に「Finder からのファイルオープン」フロー（Opened イベント
  → launch::open_files → ビューワー生成、ラベル互換の注意）を 1 節追記する

## 作業フロー

- `main` から `feat/finder-open-with` を作成、PR は `main` 向け
- 品質ゲート: `cargo fmt` / `cargo clippy`（警告ゼロ）/ `cargo test` +
  `pnpm format` / `pnpm lint` / `pnpm test` / `npx tsc --noEmit`
