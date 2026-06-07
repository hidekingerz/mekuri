---
name: quality-gate
description: Run mekuri's full pre-commit quality checklist (format, lint, test, clippy, type check) across both the TypeScript frontend and Rust backend. Use before committing or when the user asks to run all checks / quality gate.
disable-model-invocation: true
---

# quality-gate — コミット前フルチェック

CLAUDE.md の「機能追加時の品質チェック」を一括実行する。CI（`.github/workflows/ci.yml`）と同条件で、ローカルで先に潰すためのもの。

## 実行順序

以下を順に実行し、**失敗したものだけ**を修正対象として報告する。途中で失敗しても全項目を走らせ、最後にまとめて結果を出す。

### フロントエンド（TypeScript / React）

```bash
pnpm format:check     # Biome フォーマット確認（崩れていれば pnpm format で修正）
pnpm lint             # Biome リント（biome check src/）
npx tsc --noEmit      # 型チェック
pnpm test             # Vitest
```

### バックエンド（Rust）

```bash
cd src-tauri
cargo fmt --check     # フォーマット確認（崩れていれば cargo fmt で修正）
cargo clippy -- -D warnings   # 警告ゼロであること
cargo test            # 単体テスト
```

## レポート

最後に各項目の ✅ / ❌ を一覧で示す。例:

```
フロントエンド  format ✅  lint ✅  tsc ✅  test ✅
バックエンド    fmt ✅  clippy ❌  test ✅
```

- ❌ があれば、その出力を提示し修正方針を述べる。フォーマット系（format / fmt）の失敗は自動修正コマンドを実行してよい。
- lint / clippy / test / tsc の失敗はコード修正が必要なので、内容を確認してから直す。
- すべて ✅ なら「コミット可能」と明言する（CLAUDE.md の規約に従い、エラーは全て解消してからコミット）。
