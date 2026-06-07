---
name: release
description: Bump mekuri version across package.json, src-tauri/Cargo.toml, and src-tauri/tauri.conf.json in sync, then commit. Use when the user wants to bump the version or cut a release.
disable-model-invocation: true
---

# release — バージョン同期リリース

mekuri のバージョンは **3 ファイル**に散在している。これらを必ず同じ値に揃えてからコミットする。

| ファイル | 該当箇所 |
|---------|---------|
| `package.json` | `"version": "x.y.z"` |
| `src-tauri/Cargo.toml` | `[package]` の `version = "x.y.z"` |
| `src-tauri/tauri.conf.json` | トップレベルの `"version": "x.y.z"` |

## 手順

1. **新バージョンを決める**
   - 引数で渡されていればそれを使う（例: `/release 1.5.0`）。
   - 渡されていなければ現在の `package.json` の version を確認し、ユーザーに「patch / minor / major のどれか、または明示バージョン」を尋ねる。
   - semver 形式（`x.y.z`）であることを確認する。

2. **3 ファイルを更新する**
   - `package.json`: `"version"` フィールド。
   - `src-tauri/Cargo.toml`: `[package]` セクション内の `version`（`[dependencies]` 等の他セクションの version は触らない）。
   - `src-tauri/tauri.conf.json`: トップレベルの `"version"`。
   - Edit ツールで該当行のみ置換する。3 ファイルすべてが新バージョンになっていることを確認する。

3. **Cargo.lock を更新する**
   ```bash
   cd src-tauri && cargo build --quiet
   ```
   （`Cargo.lock` の mekuri エントリのバージョンが追従する）

4. **コミットする**
   - ステージ: `package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock`
   - メッセージは英語・簡潔に、既存履歴に合わせる:
     ```
     Bump version to x.y.z
     ```
   - CLAUDE.md の規約どおり英語コミットメッセージにする。

## 注意

- バージョンの不一致はビルド・配布事故につながるため、コミット前に 3 ファイルが完全一致していることを必ず目視確認する。
- タグ付けや push はユーザーが明示的に依頼した場合のみ行う。
