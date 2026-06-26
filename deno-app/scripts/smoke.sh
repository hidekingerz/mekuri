#!/usr/bin/env bash
#
# smoke.sh — ヘッドレス GUI スモークテスト（macOS）。
#
# 現在の `src/` を `pnpm build`（= tsc && vite build）してから `deno desktop` でアプリを
# ビルドし、`open --stderr` で起動して、webview の未捕捉エラー（main.ts の ERR_FORWARDER が
# `[web]` 行として stderr へ転送）が出たら FAIL する。移行漏れの Tauri API
# （`__TAURI_INTERNALS__` 参照）による白画面を、GUI を見ずに自動検知する。
#
# 前提: macOS ＋ canary deno（`deno desktop`）が PATH 先頭にあること。
# 使い方: deno-app/ で `deno task smoke`

set -uo pipefail
cd "$(dirname "$0")/.." # deno-app/

if [[ "$(uname)" != "Darwin" ]]; then
  echo "[smoke] SKIP: macOS 専用（open --stderr を使用）"
  exit 0
fi

TMP="$(mktemp -d)"
APP="$TMP/Smoke.app"
LOG="$TMP/app.err"
cleanup() {
  pkill -f "Smoke.app/Contents" 2>/dev/null
  pkill laufey_webview 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "[smoke] building frontend (pnpm build)..."
if ! (cd .. && pnpm build) >"$TMP/vite.log" 2>&1; then
  echo "[smoke] FAIL: frontend build (tsc && vite build) error"
  tail -25 "$TMP/vite.log"
  exit 1
fi

echo "[smoke] building desktop app (deno desktop)..."
if ! deno desktop --output "$APP" --include ../dist -A main.ts >"$TMP/build.log" 2>&1; then
  echo "[smoke] FAIL: desktop build error"
  tail -25 "$TMP/build.log"
  exit 1
fi

: >"$LOG"
echo "[smoke] launching (7s)..."
open --stderr "$LOG" "$APP"
sleep 7
pkill -f "Smoke.app/Contents" 2>/dev/null
pkill laufey_webview 2>/dev/null

errs="$(grep -E '\[web\]|__TAURI_INTERNALS__' "$LOG" || true)"
if [[ -n "$errs" ]]; then
  echo "[smoke] FAIL — webview 実行時エラー:"
  echo "$errs"
  exit 1
fi

echo "[smoke] OK — webview に実行時エラーなし"
exit 0
