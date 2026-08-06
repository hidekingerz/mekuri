# ファイル移動機能（D&D 仕分け）設計

- 日付: 2026-08-03
- 対象ブランチ: `feat/move-file`（`main` ベース、Tauri/Rust 版）

## 背景と目的

閲覧しながら「読んだものを仕分ける」操作を D&D で行えるようにする。
対象は 2 面:

1. **メインウィンドウ**: ファイルリストの項目をフォルダツリーのフォルダへ D&D で移動
2. **ビューワー**: 閲覧中ファイルを、ビューワー内に表示したサブフォルダ一覧へ
   D&D（またはチップのクリック）で移動

## 要件

- 移動先に同名ファイルが存在する場合は**エラー**（上書き・自動リネームはしない）
- ビューワーでの移動後は**その場に留まる**: 新パスで同じファイルの閲覧を継続し、
  直前のスプレッド位置に復帰する
- ビューワーのサブフォルダ一覧は「閲覧中ファイルと同じフォルダ直下のサブフォルダ」
- サブフォルダ一覧はフッターのボタンで開閉するトグルパネル（普段は非表示）
- 見開き画像のドラッグは**パネルが開いている間のみ**有効
  （通常時のクリックページ送りと干渉しない）
- 別ボリュームへの移動も可能（rename 失敗時に copy + delete フォールバック）
- 移動対象はアーカイブ/PDF ファイルのみ（FileList・ビューワーが扱うものと同一）

## 変更点

### 1. Rust: `move_file` コマンド（`src-tauri/src/commands/fs.rs`）

`trash_file` と同じ流儀で追加する:

```rust
#[tauri::command]
pub fn move_file(src: String, dest_dir: String) -> Result<String, String>
// Ok(移動後の新パス)
```

検証（すべて事前チェックし、わかりやすいエラーメッセージを返す）:

- `src` が存在するファイルであること
- `dest_dir` が存在するディレクトリであること
- 移動先 `dest_dir/<srcのファイル名>` が既に存在すればエラー
- 移動元フォルダと移動先フォルダが同一ならエラー

実行: `std::fs::rename` を試み、失敗した場合（クロスデバイス等）は
`std::fs::copy` + `std::fs::remove_file` にフォールバック。
コピー後の削除に失敗した場合はコピー先を残したままエラーを返す（二重存在を許容し、
データ喪失は起こさない）。

`#[cfg(test)]` 単体テスト: 成功（rename パス）・同名衝突・src 不存在・
src がディレクトリ・dest_dir 不存在・同一フォルダ。

`lib.rs` の `invoke_handler` に登録する。

### 2. API 層とイベント

- `src/api/directory.ts` に `moveFile(src: string, destDir: string): Promise<string>`
  を追加（`invoke("move_file", ...)` の薄いラッパー）
- 移動成功後、実行側（メインウィンドウ / ビューワー）は Tauri イベント
  **`file-moved`** を emit する
- `FileList` は既存の `file-trashed` リスナーと並べて `file-moved` でも一覧を
  再読込する。フォルダツリーはフォルダ構成が変わらないため更新しない

### 3. メインウィンドウ D&D（FileList → FolderTree）

- `FileList` の各ファイル項目に `draggable` を付け、`dragstart` で
  `dataTransfer.setData("application/x-mekuri-file", path)` をセット
- `TreeNode`（フォルダノード）:
  - `dragover`: 型 `application/x-mekuri-file` を含む場合のみ `preventDefault` し、
    ハイライト用 CSS クラスを付与
  - `dragleave` / `drop`: ハイライト解除
  - `drop`: パスを取り出し、App から渡されたコールバック
    `onFileDrop(srcPath: string, destDir: string)` を呼ぶ
- `App` が `onFileDrop` で `moveFile` を実行し、成功時に `emit("file-moved")`、
  失敗時はツールバー付近にエラーバナーを表示する（次の操作で消える）
- ドロップ先はツリーに**見えているフォルダノードのみ**。ホバーでの自動展開は
  実装しない（YAGNI）
- **FavoritesSidebar のお気に入り項目もドロップターゲット**にする（ツリーには
  ルート自身がノードとして存在しないため、サブフォルダ → ルートへの移動経路）。
  ハイライトは `favorites-sidebar__item--drop-target`

### 4. ビューワー D&D（見開き画像 → サブフォルダチップ）

- 新コンポーネント `src/components/SubfolderPanel/SubfolderPanel.tsx`:
  - props: `archivePath`（閲覧中ファイル）、`onMove(destDir: string)`
  - `readDirectoryFolders(親フォルダ)` で直下サブフォルダを取得しチップ列で表示。
    サブフォルダが無い場合はその旨を表示
  - 先頭に**「↑ 親フォルダへ」チップ**（閲覧中フォルダの親 = 上の階層へ移動）を
    表示する（破線ボーダーで区別）。親が導出できない場合
    （`getParentDirectory` が同一パスを返すルート到達時）は表示しない
  - チップ: `dragover`（型チェック + ハイライト）/ `drop` / `click` のいずれでも
    `onMove(サブフォルダのパス)` を呼ぶ
  - フッター直上のオーバーレイとして表示（閲覧領域のレイアウトは変えない）
- `SpreadViewer` に追加する props:
  - `movePanel?: { open: boolean; onToggle: () => void; dragData: string }`
  - 指定時、フッターのトグル群にパネル開閉ボタン（`FolderIcon` 流用または新規
    `MoveFolderIcon`）を表示
  - `open` が true の間だけ、見開き画像領域を `draggable` にし、`dragstart` で
    `application/x-mekuri-file` に `dragData`（閲覧中パス）をセットする
- `ViewerApp`:
  - パネル開閉 state と `lastSpreadIndex`（既存 `onSpreadChange` で記録）を保持
  - `onMove`: `moveFile` 実行 → `emit("file-moved")` → `setArchivePath(新パス)`
    で再読込 → `SpreadViewer` の新 props `initialSpreadIndex` に記録済み位置を
    渡して復帰。エラーは既存 `trashError` と同じ場所に表示する state（`moveError`）
  - タイトルはファイル名が変わらないため更新不要。`archivePathRef` は新パスに追従
    （既存の setArchivePath フローで自動）
- `SpreadViewer` に `initialSpreadIndex?: number` を追加: マウント後、グループ構築
  が済んだ時点で一度だけ該当グループの先頭ページへジャンプする（既定は 0 のまま）

### 5. 既知の制約（受容する）

- 移動後もウィンドウラベルは旧パスのハッシュのまま（Tauri のラベルは変更不可）。
  移動後のファイルを改めてツリー等から開くと二重オープン防止が効かない場合がある。
  これは既存の兄弟ナビゲーション・Trash 後遷移と同じ挙動であり、今回の新規リスク
  ではない
- 移動後の前後ファイル送り（sibling navigation）は移動先フォルダ基準になる

## エラー処理

- `move_file` のエラーメッセージは英語（既存コマンドの `Result<T, String>` と同様）
- メインウィンドウ: ツールバー付近のバナーに表示
- ビューワー: 既存エラー表示と同様にビューワー内へ表示
- いずれもアプリはクラッシュさせず、ファイルは元の場所に残る

## テスト

- Rust: `move_file` の単体テスト（上記 6 ケース）。`cargo fmt` / `cargo clippy
  -- -D warnings` / `cargo test`
- フロント: 既存テストの回帰（`pnpm test`）+ `npx tsc --noEmit` / `pnpm lint` /
  `pnpm format`。D&D の操作は手動確認:
  1. ファイルリスト → ツリーへ D&D で移動、リスト再読込
  2. 同名衝突でエラーバナー、ファイルは移動されない
  3. ビューワー: パネル開 → 画像をチップへ D&D → 移動後も同じページ位置で継続
  4. チップクリックでも移動できる
  5. パネル閉時は画像がドラッグできない（クリックページ送りが従来どおり）
  6. サブフォルダの無いフォルダでパネルを開くと空表示
  7. 別ボリュームへの移動（可能な環境で）

## 作業フロー

- `main` から `feat/move-file` を作成、PR は `main` 向け
- 品質ゲート: フロント（format / lint / test / tsc）+ Rust（fmt / clippy -D
  warnings / test）
