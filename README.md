# mekuri

圧縮ファイル（ZIP/RAR）内の画像を見開き表示で閲覧するデスクトップアプリケーション。

## 特徴

- **お気に入りフォルダ**: よく使うフォルダを登録して素早くアクセス
- **フォルダツリー**: ディレクトリ階層をツリー表示し、アーカイブファイルを探索
- **見開きビューワー**: アーカイブ内の画像を2ページ並列で表示（右綴じ対応）
- **マルチウィンドウ**: メインウィンドウとビューワーウィンドウの分離
- **設定の永続化**: ウィンドウサイズやカラム幅を自動保存

## 必要環境

### システム要件

- **Node.js** 18以上
- **pnpm** 8以上
- **Rust** 1.70以上

### macOS

Xcode Command Line Toolsが必要です:

```bash
xcode-select --install
```

### Windows

- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/hidekingerz/mekuri.git
cd mekuri

# 依存関係をインストール
pnpm install
```

## 開発

```bash
# 開発モードで起動（ホットリロード有効）
pnpm tauri dev
```

## ビルド

```bash
# プロダクションビルド
pnpm tauri build
```

ビルド成果物は以下に生成されます:

- **macOS**: `src-tauri/target/release/bundle/macos/mekuri.app`
- **Windows**: `src-tauri/target/release/bundle/msi/` または `nsis/`

## テスト・リント

```bash
# TypeScript リント
pnpm lint

# TypeScript フォーマット
pnpm format

# TypeScript テスト
pnpm test

# Rust リント
cd src-tauri && cargo clippy

# Rust フォーマット
cd src-tauri && cargo fmt

# Rust テスト
cd src-tauri && cargo test
```

## キーボードショートカット

### ビューワー

| キー | 動作 |
|------|------|
| `←` / `→` | ページ送り/戻し |
| `Home` / `End` | 最初/最後のページへ |
| `Alt + ↑` | 同一フォルダ内の次のアーカイブを開く |
| `Alt + ↓` | 同一フォルダ内の前のアーカイブを開く |
| マウスホイール | ページ送り/戻し |

## 技術スタック

- **Tauri v2** (Rust + React)
- **React 19** + TypeScript
- **Vite**

## ドキュメント

- [要件定義書](docs/requirements.md)
- [アーキテクチャ設計書](docs/architecture.md)
- [技術スタック](docs/tech-stack.md)
- [ディレクトリ構成](docs/directory-structure.md)

## ライセンス

MIT
