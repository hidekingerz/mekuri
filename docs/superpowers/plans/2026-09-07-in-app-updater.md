# アプリ内アップデート機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Releases の新バージョンをアプリ内で検知し、[Update] → [Restart] の 2 操作でダウンロード・差し替え・再起動できるようにする。

**Architecture:** `tauri-plugin-updater` と `tauri-plugin-process` を登録し、確認・ダウンロード・再起動はフロントエンド (JS API) から行う。状態遷移は `utils/updateState.ts` の純粋 reducer に閉じ込め、`hooks/useUpdater.ts` がプラグイン呼び出しと reducer を結び、`components/UpdateBanner` がツールバーに表示する。配信は release.yml が生成する `latest.json` + `mekuri.app.tar.gz` + `.sig` を GitHub Releases に添付し、`releases/latest/download/latest.json` を唯一のエンドポイントにする。

**Tech Stack:** Tauri v2 (`tauri-plugin-updater` 2.x, `tauri-plugin-process` 2.x) / React 19 + TypeScript / Vitest / GitHub Actions + `gh` CLI + `jq`

**Spec:** `docs/superpowers/specs/2026-09-07-in-app-updater-design.md`

## Global Constraints

- ブランチ: `feat/in-app-updater` (`main` ベース)。`main` へ直接コミットしない
- 対象プラットフォームは macOS Apple Silicon (`darwin-aarch64`) のみ
- 署名は minisign 形式 (Tauri updater 標準)。**本番の秘密鍵は AI セッションを経由させない**。鍵生成はリポジトリオーナーが手元で行う
- エンドポイントは 1 件のみ: `https://github.com/hidekingerz/mekuri/releases/latest/download/latest.json`
- Rust 側の追加はプラグイン登録のみ。新規コマンドは追加しない
- 「このバージョンをスキップ」「自動確認のオン/オフ設定」は作らない
- 起動時の自動確認は失敗しても何も表示しない。手動確認の失敗のみバナーに出す
- UI 文言・エラーメッセージ・コミットメッセージは英語
- 品質ゲート (Rust): `cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test`
- 品質ゲート (フロント): `pnpm format && pnpm lint && pnpm test && npx tsc --noEmit`
- バージョンは 1.9.0 (Task 9)

---

## 前提: リポジトリオーナーの手元作業 (AI は実行しない)

Task 1 の `pubkey` と Task 7 の CI 署名に必要。**Task 1 に着手する前に、少なくとも公開鍵が手元にあること**。まだ無い場合は Task 1 の Step 4 の代替手順 (開発用鍵) で進め、マージ前に差し替える。

- [ ] 鍵ペアを生成する (パスワードを聞かれるので設定する):

```bash
pnpm tauri signer generate -w ~/.tauri/mekuri.key
```

- [ ] 公開鍵の内容を控える (1 行の文字列。これを Task 1 で `tauri.conf.json` に貼る):

```bash
cat ~/.tauri/mekuri.key.pub
```

- [ ] GitHub Secrets を登録する (リポジトリ Settings → Secrets and variables → Actions):
  - `TAURI_SIGNING_PRIVATE_KEY`: `cat ~/.tauri/mekuri.key` の内容 (ファイルの中身そのもの)
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: 生成時に設定したパスワード

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/mekuri.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

- [ ] `~/.tauri/mekuri.key` をバックアップする。紛失すると以後のリリースを既存ユーザーが受け取れなくなる (公開鍵を変えた版は署名検証に失敗する)。

---

### Task 1: プラグインの配線 (Rust / 設定 / npm)

**Files:**
- Modify: `src-tauri/Cargo.toml` (`[dependencies]`)
- Modify: `src-tauri/src/lib.rs` (`tauri::Builder` の `.plugin(...)` チェーン)
- Modify: `src-tauri/capabilities/default.json` (`permissions`)
- Modify: `src-tauri/tauri.conf.json` (`bundle.createUpdaterArtifacts`, `plugins.updater`)
- Modify: `package.json` (`dependencies`)

**Interfaces:**
- Consumes: なし
- Produces (Task 3 が使用): npm パッケージ `@tauri-apps/plugin-updater` (`check`, `Update`) と `@tauri-apps/plugin-process` (`relaunch`) が import 可能で、対応する権限 `updater:default` / `process:default` が `main` ウィンドウに付与されている

- [ ] **Step 1: Rust の依存を追加する**

`src-tauri/Cargo.toml` の `[dependencies]` で `tauri-plugin-store = "2"` の直後に追加:

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

- [ ] **Step 2: プラグインを登録する**

`src-tauri/src/lib.rs` の `.plugin(tauri_plugin_store::Builder::default().build())` の直後に追加:

```rust
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
```

- [ ] **Step 3: 権限を追加する**

`src-tauri/capabilities/default.json` の `permissions` 配列末尾 (`"store:default"` の後) に追加:

```json
    "updater:default",
    "process:default"
```

- [ ] **Step 4: tauri.conf.json を更新する**

`bundle` に `createUpdaterArtifacts` を追加し、`plugins` を埋める。`<PUBKEY>` は「前提」で控えた `mekuri.key.pub` の内容 (1 行) に置き換える:

```json
  "bundle": {
    "createUpdaterArtifacts": true,
    "icon": [
```

```json
  "plugins": {
    "updater": {
      "pubkey": "<PUBKEY>",
      "endpoints": [
        "https://github.com/hidekingerz/mekuri/releases/latest/download/latest.json"
      ]
    }
  }
```

**本番公開鍵がまだ手元に無い場合の代替手順**: 開発用の鍵を生成して一時的に使う。この鍵は本番には使わない。

```bash
pnpm tauri signer generate -w ~/.tauri/mekuri-dev.key -p devpass --ci
cat ~/.tauri/mekuri-dev.key.pub
```

`--ci` はプロンプトを省略するオプション。パスワードは `-p devpass` で明示する (無パスワードの鍵は CLI から署名できない)。この公開鍵を `<PUBKEY>` に入れ、PR 本文に「`plugins.updater.pubkey` は開発用鍵。マージ前に本番公開鍵に差し替える」と明記する。Task 9 のチェックリストで差し替えを確認する。

- [ ] **Step 5: npm パッケージを追加する**

```bash
pnpm add @tauri-apps/plugin-updater@^2 @tauri-apps/plugin-process@^2
```

`package.json` の `dependencies` に `"@tauri-apps/plugin-process": "^2.x.x"` と `"@tauri-apps/plugin-updater": "^2.x.x"` が入ることを確認する (アルファベット順に並ぶ)。

- [ ] **Step 6: Rust 側の検証**

```bash
cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test
```

Expected: 警告ゼロ、既存テストがすべて PASS。`tauri.conf.json` の `plugins.updater` の形式が誤っていると `tauri::generate_context!()` でビルドエラーになるので、ここで気づける。

- [ ] **Step 7: フロント側の検証**

```bash
npx tsc --noEmit && pnpm lint
```

Expected: エラーなし。

- [ ] **Step 8: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/tauri.conf.json package.json pnpm-lock.yaml
git commit -m "Register updater and process plugins"
```

---

### Task 2: 状態遷移 reducer (`utils/updateState.ts`)

**Files:**
- Create: `src/utils/updateState.ts`
- Test: `src/utils/updateState.test.ts`

**Interfaces:**
- Consumes: なし
- Produces (Task 4, 5 が使用):

```ts
export type UpdateInfo = { version: string; notes: string | null };

export type UpdateState =
  | { status: "idle" }
  | { status: "checking"; manual: boolean }
  | { status: "upToDate" }
  | { status: "available"; update: UpdateInfo }
  | { status: "downloading"; update: UpdateInfo; downloaded: number; total: number | null }
  | { status: "ready"; update: UpdateInfo }
  | { status: "error"; message: string; retry: "check" | "install" | null; update?: UpdateInfo };

export type UpdateEvent =
  | { type: "CHECK_STARTED"; manual: boolean }
  | { type: "CHECK_FOUND"; update: UpdateInfo }
  | { type: "CHECK_NONE" }
  | { type: "CHECK_FAILED"; message: string }
  | { type: "DOWNLOAD_STARTED" }
  | { type: "DOWNLOAD_PROGRESS"; downloaded: number; total: number | null }
  | { type: "DOWNLOAD_FINISHED" }
  | { type: "DOWNLOAD_FAILED"; message: string }
  | { type: "RETRY_INSTALL" }
  | { type: "RELAUNCH_FAILED"; message: string }
  | { type: "DISMISS" };

export const INITIAL_UPDATE_STATE: UpdateState;
export function updateReducer(state: UpdateState, event: UpdateEvent): UpdateState;
```

設計書との差分 (意図的):
- `downloading` / `ready` は `version` ではなく `update: UpdateInfo` を持つ。`DOWNLOAD_FAILED` で `available` に戻すための `notes` を失わないため。
- `RETRY_INSTALL` を追加。`error(retry: "install")` → `available` の遷移を reducer で表現するため。`retry: "check"` の Retry はフックが `checkNow()` を呼ぶだけなので専用イベントは不要。
- `RELAUNCH_FAILED` を追加。設計書 4 章の「`relaunch()` 失敗は `error(retry: null)`」を表現するため。

- [ ] **Step 1: テストを書く**

`src/utils/updateState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  INITIAL_UPDATE_STATE,
  type UpdateInfo,
  type UpdateState,
  updateReducer,
} from "./updateState";

const update: UpdateInfo = { version: "1.9.0", notes: "notes" };
const available: UpdateState = { status: "available", update };
const downloading: UpdateState = { status: "downloading", update, downloaded: 10, total: 100 };
const ready: UpdateState = { status: "ready", update };

describe("updateReducer", () => {
  it("starts in idle", () => {
    expect(INITIAL_UPDATE_STATE).toEqual({ status: "idle" });
  });

  describe("CHECK_STARTED", () => {
    it("moves idle to checking with the manual flag", () => {
      expect(updateReducer({ status: "idle" }, { type: "CHECK_STARTED", manual: true })).toEqual({
        status: "checking",
        manual: true,
      });
      expect(updateReducer({ status: "idle" }, { type: "CHECK_STARTED", manual: false })).toEqual({
        status: "checking",
        manual: false,
      });
    });

    it("can start from available, upToDate and error", () => {
      for (const from of [
        available,
        { status: "upToDate" } as UpdateState,
        { status: "error", message: "x", retry: "check" } as UpdateState,
      ]) {
        expect(updateReducer(from, { type: "CHECK_STARTED", manual: true })).toEqual({
          status: "checking",
          manual: true,
        });
      }
    });

    it("is ignored while downloading or ready", () => {
      expect(updateReducer(downloading, { type: "CHECK_STARTED", manual: true })).toBe(downloading);
      expect(updateReducer(ready, { type: "CHECK_STARTED", manual: true })).toBe(ready);
    });
  });

  describe("check results", () => {
    it("CHECK_FOUND moves checking to available", () => {
      expect(
        updateReducer({ status: "checking", manual: false }, { type: "CHECK_FOUND", update }),
      ).toEqual(available);
    });

    it("CHECK_NONE on a manual check shows upToDate", () => {
      expect(updateReducer({ status: "checking", manual: true }, { type: "CHECK_NONE" })).toEqual({
        status: "upToDate",
      });
    });

    it("CHECK_NONE on an automatic check returns to idle", () => {
      expect(updateReducer({ status: "checking", manual: false }, { type: "CHECK_NONE" })).toEqual({
        status: "idle",
      });
    });

    it("CHECK_FAILED on a manual check shows an error with check retry", () => {
      expect(
        updateReducer({ status: "checking", manual: true }, { type: "CHECK_FAILED", message: "offline" }),
      ).toEqual({ status: "error", message: "offline", retry: "check" });
    });

    it("CHECK_FAILED on an automatic check returns to idle", () => {
      expect(
        updateReducer(
          { status: "checking", manual: false },
          { type: "CHECK_FAILED", message: "offline" },
        ),
      ).toEqual({ status: "idle" });
    });

    it("check results are ignored outside checking", () => {
      expect(updateReducer(available, { type: "CHECK_NONE" })).toBe(available);
      expect(updateReducer(downloading, { type: "CHECK_FOUND", update })).toBe(downloading);
      expect(updateReducer({ status: "idle" }, { type: "CHECK_FAILED", message: "x" })).toEqual({
        status: "idle",
      });
    });
  });

  describe("download", () => {
    it("DOWNLOAD_STARTED moves available to downloading with zero progress", () => {
      expect(updateReducer(available, { type: "DOWNLOAD_STARTED" })).toEqual({
        status: "downloading",
        update,
        downloaded: 0,
        total: null,
      });
    });

    it("DOWNLOAD_STARTED is ignored outside available", () => {
      expect(updateReducer({ status: "idle" }, { type: "DOWNLOAD_STARTED" })).toEqual({
        status: "idle",
      });
      expect(updateReducer(downloading, { type: "DOWNLOAD_STARTED" })).toBe(downloading);
    });

    it("DOWNLOAD_PROGRESS updates downloaded and total", () => {
      expect(
        updateReducer(downloading, { type: "DOWNLOAD_PROGRESS", downloaded: 50, total: 200 }),
      ).toEqual({ status: "downloading", update, downloaded: 50, total: 200 });
    });

    it("DOWNLOAD_PROGRESS is ignored outside downloading", () => {
      expect(
        updateReducer(available, { type: "DOWNLOAD_PROGRESS", downloaded: 50, total: 200 }),
      ).toBe(available);
    });

    it("DOWNLOAD_FINISHED moves downloading to ready", () => {
      expect(updateReducer(downloading, { type: "DOWNLOAD_FINISHED" })).toEqual(ready);
    });

    it("DOWNLOAD_FAILED keeps the update so it can be retried", () => {
      expect(updateReducer(downloading, { type: "DOWNLOAD_FAILED", message: "bad sig" })).toEqual({
        status: "error",
        message: "bad sig",
        retry: "install",
        update,
      });
    });

    it("RETRY_INSTALL restores available from an install error", () => {
      const err: UpdateState = { status: "error", message: "x", retry: "install", update };
      expect(updateReducer(err, { type: "RETRY_INSTALL" })).toEqual(available);
    });

    it("RETRY_INSTALL is ignored for other errors and states", () => {
      const checkErr: UpdateState = { status: "error", message: "x", retry: "check" };
      expect(updateReducer(checkErr, { type: "RETRY_INSTALL" })).toBe(checkErr);
      expect(updateReducer(available, { type: "RETRY_INSTALL" })).toBe(available);
    });
  });

  describe("relaunch", () => {
    it("RELAUNCH_FAILED moves ready to a non-retryable error", () => {
      expect(updateReducer(ready, { type: "RELAUNCH_FAILED", message: "nope" })).toEqual({
        status: "error",
        message: "nope",
        retry: null,
      });
    });

    it("RELAUNCH_FAILED is ignored outside ready", () => {
      expect(updateReducer(available, { type: "RELAUNCH_FAILED", message: "nope" })).toBe(available);
    });
  });

  describe("DISMISS", () => {
    it("returns available, upToDate and error to idle", () => {
      for (const from of [
        available,
        { status: "upToDate" } as UpdateState,
        { status: "error", message: "x", retry: null } as UpdateState,
      ]) {
        expect(updateReducer(from, { type: "DISMISS" })).toEqual({ status: "idle" });
      }
    });

    it("is ignored while checking, downloading and ready", () => {
      const checking: UpdateState = { status: "checking", manual: true };
      expect(updateReducer(checking, { type: "DISMISS" })).toBe(checking);
      expect(updateReducer(downloading, { type: "DISMISS" })).toBe(downloading);
      expect(updateReducer(ready, { type: "DISMISS" })).toBe(ready);
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
pnpm test -- src/utils/updateState.test.ts
```

Expected: FAIL (モジュール `./updateState` が見つからない)。

- [ ] **Step 3: reducer を実装する**

`src/utils/updateState.ts`:

```ts
export type UpdateInfo = { version: string; notes: string | null };

export type UpdateState =
  | { status: "idle" }
  | { status: "checking"; manual: boolean }
  | { status: "upToDate" }
  | { status: "available"; update: UpdateInfo }
  | { status: "downloading"; update: UpdateInfo; downloaded: number; total: number | null }
  | { status: "ready"; update: UpdateInfo }
  | { status: "error"; message: string; retry: "check" | "install" | null; update?: UpdateInfo };

export type UpdateEvent =
  | { type: "CHECK_STARTED"; manual: boolean }
  | { type: "CHECK_FOUND"; update: UpdateInfo }
  | { type: "CHECK_NONE" }
  | { type: "CHECK_FAILED"; message: string }
  | { type: "DOWNLOAD_STARTED" }
  | { type: "DOWNLOAD_PROGRESS"; downloaded: number; total: number | null }
  | { type: "DOWNLOAD_FINISHED" }
  | { type: "DOWNLOAD_FAILED"; message: string }
  | { type: "RETRY_INSTALL" }
  | { type: "RELAUNCH_FAILED"; message: string }
  | { type: "DISMISS" };

export const INITIAL_UPDATE_STATE: UpdateState = { status: "idle" };

const IDLE: UpdateState = { status: "idle" };

/**
 * アップデート UI の状態遷移。副作用は持たず、無効な遷移は state をそのまま返す。
 * 自動確認 (manual: false) の失敗と「最新です」は何も表示せず idle に戻る。
 */
export function updateReducer(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case "CHECK_STARTED":
      if (state.status === "downloading" || state.status === "ready") return state;
      return { status: "checking", manual: event.manual };

    case "CHECK_FOUND":
      if (state.status !== "checking") return state;
      return { status: "available", update: event.update };

    case "CHECK_NONE":
      if (state.status !== "checking") return state;
      return state.manual ? { status: "upToDate" } : IDLE;

    case "CHECK_FAILED":
      if (state.status !== "checking") return state;
      return state.manual ? { status: "error", message: event.message, retry: "check" } : IDLE;

    case "DOWNLOAD_STARTED":
      if (state.status !== "available") return state;
      return { status: "downloading", update: state.update, downloaded: 0, total: null };

    case "DOWNLOAD_PROGRESS":
      if (state.status !== "downloading") return state;
      return { ...state, downloaded: event.downloaded, total: event.total };

    case "DOWNLOAD_FINISHED":
      if (state.status !== "downloading") return state;
      return { status: "ready", update: state.update };

    case "DOWNLOAD_FAILED":
      if (state.status !== "downloading") return state;
      return { status: "error", message: event.message, retry: "install", update: state.update };

    case "RETRY_INSTALL":
      if (state.status !== "error" || state.retry !== "install" || !state.update) return state;
      return { status: "available", update: state.update };

    case "RELAUNCH_FAILED":
      if (state.status !== "ready") return state;
      return { status: "error", message: event.message, retry: null };

    case "DISMISS":
      if (state.status === "available" || state.status === "upToDate" || state.status === "error") {
        return IDLE;
      }
      return state;
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
pnpm test -- src/utils/updateState.test.ts
```

Expected: 全 PASS。

- [ ] **Step 5: 品質ゲート**

```bash
pnpm format && pnpm lint && npx tsc --noEmit
```

Expected: エラーなし。`tsc` の `noFallthroughCasesInSwitch` と網羅性チェックで、`switch` の全ケースが return していることを確認する。

- [ ] **Step 6: Commit**

```bash
git add src/utils/updateState.ts src/utils/updateState.test.ts
git commit -m "Add update state reducer"
```

---

### Task 3: 進捗集計とプラグインラッパー (`utils/updateProgress.ts`, `api/updater.ts`)

**Files:**
- Create: `src/utils/updateProgress.ts`
- Test: `src/utils/updateProgress.test.ts`
- Create: `src/api/updater.ts`

**Interfaces:**
- Consumes: Task 1 の npm パッケージ、Task 2 の `UpdateInfo`
- Produces (Task 4 が使用):

```ts
// src/utils/updateProgress.ts
export type DownloadProgress = { downloaded: number; total: number | null };
export type DownloadEventLike =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };
export const INITIAL_PROGRESS: DownloadProgress;
export function accumulateProgress(prev: DownloadProgress, event: DownloadEventLike): DownloadProgress;

// src/api/updater.ts
export type AvailableUpdate = UpdateInfo; // { version: string; notes: string | null }
export async function checkForUpdate(): Promise<AvailableUpdate | null>;
export async function downloadAndInstall(onProgress: (p: DownloadProgress) => void): Promise<void>;
export async function relaunch(): Promise<void>;
```

`DownloadEventLike` は `@tauri-apps/plugin-updater` の `DownloadEvent` と構造互換の型。`utils/` を Tauri パッケージに依存させないために自前で定義する。

- [ ] **Step 1: 進捗集計のテストを書く**

`src/utils/updateProgress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { INITIAL_PROGRESS, accumulateProgress } from "./updateProgress";

describe("accumulateProgress", () => {
  it("starts with nothing downloaded and unknown total", () => {
    expect(INITIAL_PROGRESS).toEqual({ downloaded: 0, total: null });
  });

  it("Started sets the total from contentLength", () => {
    expect(
      accumulateProgress(INITIAL_PROGRESS, { event: "Started", data: { contentLength: 1000 } }),
    ).toEqual({ downloaded: 0, total: 1000 });
  });

  it("Started without contentLength keeps total unknown", () => {
    expect(accumulateProgress(INITIAL_PROGRESS, { event: "Started", data: {} })).toEqual({
      downloaded: 0,
      total: null,
    });
  });

  it("Progress accumulates chunk lengths", () => {
    const afterStart = accumulateProgress(INITIAL_PROGRESS, {
      event: "Started",
      data: { contentLength: 1000 },
    });
    const first = accumulateProgress(afterStart, { event: "Progress", data: { chunkLength: 300 } });
    const second = accumulateProgress(first, { event: "Progress", data: { chunkLength: 200 } });
    expect(first).toEqual({ downloaded: 300, total: 1000 });
    expect(second).toEqual({ downloaded: 500, total: 1000 });
  });

  it("Finished snaps downloaded to total when total is known", () => {
    expect(accumulateProgress({ downloaded: 900, total: 1000 }, { event: "Finished" })).toEqual({
      downloaded: 1000,
      total: 1000,
    });
  });

  it("Finished keeps downloaded when total is unknown", () => {
    expect(accumulateProgress({ downloaded: 900, total: null }, { event: "Finished" })).toEqual({
      downloaded: 900,
      total: null,
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
pnpm test -- src/utils/updateProgress.test.ts
```

Expected: FAIL (モジュールが見つからない)。

- [ ] **Step 3: 進捗集計を実装する**

`src/utils/updateProgress.ts`:

```ts
export type DownloadProgress = { downloaded: number; total: number | null };

/** `@tauri-apps/plugin-updater` の DownloadEvent と構造互換。utils を Tauri に依存させないための型。 */
export type DownloadEventLike =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export const INITIAL_PROGRESS: DownloadProgress = { downloaded: 0, total: null };

/** updater プラグインのダウンロードイベントを累積して進捗にする。 */
export function accumulateProgress(
  prev: DownloadProgress,
  event: DownloadEventLike,
): DownloadProgress {
  switch (event.event) {
    case "Started":
      return { downloaded: 0, total: event.data.contentLength ?? null };
    case "Progress":
      return { ...prev, downloaded: prev.downloaded + event.data.chunkLength };
    case "Finished":
      return prev.total === null ? prev : { ...prev, downloaded: prev.total };
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
pnpm test -- src/utils/updateProgress.test.ts
```

Expected: 全 PASS。

- [ ] **Step 5: プラグインラッパーを実装する**

`src/api/updater.ts`:

```ts
import { relaunch as processRelaunch } from "@tauri-apps/plugin-process";
import { type Update, check } from "@tauri-apps/plugin-updater";
import { INITIAL_PROGRESS, accumulateProgress, type DownloadProgress } from "../utils/updateProgress";
import type { UpdateInfo } from "../utils/updateState";

export type AvailableUpdate = UpdateInfo;

// プラグインの Update は check() の結果に紐づくため、直近の結果をモジュール内に保持する。
let pending: Update | null = null;

/** 最新リリースを確認する。更新が無ければ null。 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const update = await check();
  pending = update;
  if (!update) return null;
  return { version: update.version, notes: update.body ?? null };
}

/** 直近の checkForUpdate で見つかった更新をダウンロードしてインストールする。 */
export async function downloadAndInstall(
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  if (!pending) {
    throw new Error("No update has been checked");
  }
  let progress = INITIAL_PROGRESS;
  await pending.downloadAndInstall((event) => {
    progress = accumulateProgress(progress, event);
    onProgress(progress);
  });
}

/** アプリを再起動して新バージョンを立ち上げる。 */
export async function relaunch(): Promise<void> {
  await processRelaunch();
}
```

- [ ] **Step 6: 品質ゲート**

```bash
pnpm format && pnpm lint && pnpm test && npx tsc --noEmit
```

Expected: エラーなし。`downloadAndInstall` のコールバック引数 `event` が `DownloadEventLike` に代入できないと `tsc` が落ちる。その場合はプラグインの `DownloadEvent` 型定義 (`node_modules/@tauri-apps/plugin-updater/dist-js/index.d.ts`) を見て `DownloadEventLike` を合わせる。

- [ ] **Step 7: Commit**

```bash
git add src/utils/updateProgress.ts src/utils/updateProgress.test.ts src/api/updater.ts
git commit -m "Add updater API wrapper and download progress accumulator"
```

---

### Task 4: `useUpdater` フック

**Files:**
- Create: `src/hooks/useUpdater.ts`

**Interfaces:**
- Consumes: Task 2 の `updateReducer` / `INITIAL_UPDATE_STATE` / `UpdateState`、Task 3 の `checkForUpdate` / `downloadAndInstall` / `relaunch`、既存の `errorToString`
- Produces (Task 5 が使用):

```ts
export type UpdaterControls = {
  state: UpdateState;
  checkNow: () => void;
  install: () => void;
  restart: () => void;
  retry: () => void;
  dismiss: () => void;
};
export function useUpdater(): UpdaterControls;
```

- [ ] **Step 1: フックを実装する**

`src/hooks/useUpdater.ts`:

```ts
import { useCallback, useEffect, useReducer, useRef } from "react";
import { checkForUpdate, downloadAndInstall, relaunch } from "../api/updater";
import { errorToString } from "../utils/errorToString";
import { INITIAL_UPDATE_STATE, type UpdateState, updateReducer } from "../utils/updateState";

const AUTO_CHECK_DELAY_MS = 3000;
const UP_TO_DATE_DISMISS_MS = 3000;

export type UpdaterControls = {
  state: UpdateState;
  checkNow: () => void;
  install: () => void;
  restart: () => void;
  retry: () => void;
  dismiss: () => void;
};

/**
 * アプリ内アップデートの状態と操作。メインウィンドウでのみ使う。
 * マウント 3 秒後に自動確認を 1 回行う (失敗しても何も表示しない)。
 */
export function useUpdater(): UpdaterControls {
  const [state, dispatch] = useReducer(updateReducer, INITIAL_UPDATE_STATE);
  // 非同期処理の途中で最新の状態を参照するために ref に写す
  const stateRef = useRef(state);
  stateRef.current = state;

  const runCheck = useCallback(async (manual: boolean) => {
    const current = stateRef.current.status;
    if (current === "checking" || current === "downloading" || current === "ready") return;
    dispatch({ type: "CHECK_STARTED", manual });
    try {
      const update = await checkForUpdate();
      if (update) {
        dispatch({ type: "CHECK_FOUND", update });
      } else {
        dispatch({ type: "CHECK_NONE" });
      }
    } catch (err) {
      dispatch({ type: "CHECK_FAILED", message: errorToString(err) });
    }
  }, []);

  // 起動時の自動確認。StrictMode の二重実行はクリーンアップでタイマーを消すことで 1 回に抑える。
  useEffect(() => {
    const timer = setTimeout(() => {
      void runCheck(false);
    }, AUTO_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [runCheck]);

  // 「最新です」は数秒で消す
  useEffect(() => {
    if (state.status !== "upToDate") return;
    const timer = setTimeout(() => dispatch({ type: "DISMISS" }), UP_TO_DATE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [state.status]);

  const checkNow = useCallback(() => {
    void runCheck(true);
  }, [runCheck]);

  const install = useCallback(() => {
    if (stateRef.current.status !== "available") return;
    dispatch({ type: "DOWNLOAD_STARTED" });
    void (async () => {
      try {
        await downloadAndInstall((p) => {
          dispatch({ type: "DOWNLOAD_PROGRESS", downloaded: p.downloaded, total: p.total });
        });
        dispatch({ type: "DOWNLOAD_FINISHED" });
      } catch (err) {
        dispatch({ type: "DOWNLOAD_FAILED", message: errorToString(err) });
      }
    })();
  }, []);

  const restart = useCallback(() => {
    if (stateRef.current.status !== "ready") return;
    void relaunch().catch((err) => {
      dispatch({ type: "RELAUNCH_FAILED", message: errorToString(err) });
    });
  }, []);

  const retry = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== "error") return;
    if (current.retry === "check") {
      void runCheck(true);
    } else if (current.retry === "install") {
      dispatch({ type: "RETRY_INSTALL" });
    }
  }, [runCheck]);

  const dismiss = useCallback(() => dispatch({ type: "DISMISS" }), []);

  return { state, checkNow, install, restart, retry, dismiss };
}
```

- [ ] **Step 2: 品質ゲート**

```bash
pnpm format && pnpm lint && npx tsc --noEmit
```

Expected: エラーなし。Biome がレンダー中の `stateRef.current = state` に警告を出す場合は、その行の直前に次を付ける:

```ts
  // biome-ignore lint/correctness/useHookAtTopLevel: syncing ref during render is intentional
```

(実際に出た警告のルール名に合わせる。警告が出なければ何も付けない。)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useUpdater.ts
git commit -m "Add useUpdater hook"
```

---

### Task 5: `UpdateBanner` コンポーネントとツールバー配線

**Files:**
- Create: `src/components/UpdateBanner/UpdateBanner.tsx`
- Modify: `src/App.tsx` (import、`useUpdater` 呼び出し、ツールバー JSX)
- Modify: `src/styles/global.css` (`.toolbar__error-close` の直後にバナー用スタイルを追加)

**Interfaces:**
- Consumes: Task 4 の `useUpdater` / `UpdaterControls`、Task 2 の `UpdateState`
- Produces: なし (UI の末端)

```ts
export type UpdateBannerProps = {
  state: UpdateState;
  onInstall: () => void;
  onRestart: () => void;
  onRetry: () => void;
  onDismiss: () => void;
};
export function UpdateBanner(props: UpdateBannerProps): JSX.Element | null;
```

- [ ] **Step 1: バナーを実装する**

`src/components/UpdateBanner/UpdateBanner.tsx`:

```tsx
import type { UpdateState } from "../../utils/updateState";

export type UpdateBannerProps = {
  state: UpdateState;
  onInstall: () => void;
  onRestart: () => void;
  onRetry: () => void;
  onDismiss: () => void;
};

function percent(downloaded: number, total: number | null): number | null {
  if (total === null || total <= 0) return null;
  return Math.min(100, Math.floor((downloaded / total) * 100));
}

/** ツールバー右側に出すアップデート状態バナー。idle と自動確認中は何も描画しない。 */
export function UpdateBanner({ state, onInstall, onRestart, onRetry, onDismiss }: UpdateBannerProps) {
  switch (state.status) {
    case "idle":
      return null;

    case "checking":
      if (!state.manual) return null;
      return (
        <div className="toolbar__error update-banner update-banner--neutral" role="status">
          <span>Checking for updates…</span>
        </div>
      );

    case "upToDate":
      return (
        <div className="toolbar__error update-banner update-banner--neutral" role="status">
          <span>You're up to date</span>
        </div>
      );

    case "available":
      return (
        <div className="toolbar__error update-banner update-banner--neutral" role="status">
          <span>v{state.update.version} is available</span>
          <button type="button" className="update-banner__btn" onClick={onInstall}>
            Update
          </button>
          <button type="button" className="toolbar__error-close" onClick={onDismiss}>
            ×
          </button>
        </div>
      );

    case "downloading": {
      const pct = percent(state.downloaded, state.total);
      return (
        <div className="toolbar__error update-banner update-banner--neutral" role="status">
          <span>
            Downloading v{state.update.version}…{pct !== null ? ` ${pct}%` : ""}
          </span>
          <div
            className={`update-banner__progress ${pct === null ? "update-banner__progress--indeterminate" : ""}`}
          >
            <div className="update-banner__progress-bar" style={{ width: `${pct ?? 40}%` }} />
          </div>
        </div>
      );
    }

    case "ready":
      return (
        <div className="toolbar__error update-banner update-banner--neutral" role="status">
          <span>v{state.update.version} installed. Restart to finish</span>
          <button type="button" className="update-banner__btn" onClick={onRestart}>
            Restart
          </button>
        </div>
      );

    case "error":
      return (
        <div className="toolbar__error update-banner" role="alert">
          <span>
            {state.retry === null
              ? `Update failed: ${state.message}. Please restart mekuri manually`
              : `Update failed: ${state.message}`}
          </span>
          {state.retry !== null && (
            <button type="button" className="update-banner__btn" onClick={onRetry}>
              Retry
            </button>
          )}
          <button type="button" className="toolbar__error-close" onClick={onDismiss}>
            ×
          </button>
        </div>
      );
  }
}
```

- [ ] **Step 2: スタイルを追加する**

`src/styles/global.css` の `.toolbar__error-close { ... }` ブロックの直後に追加:

```css
/* Update banner (reuses .toolbar__error layout) */
.update-banner--neutral {
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}

.update-banner__btn {
  padding: 2px 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.update-banner__btn:hover {
  background: var(--color-bg-active);
}

.update-banner__progress {
  width: 80px;
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
  overflow: hidden;
  flex-shrink: 0;
}

.update-banner__progress-bar {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.15s ease;
}

.update-banner__progress--indeterminate .update-banner__progress-bar {
  animation: update-banner-slide 1.2s ease-in-out infinite;
}

@keyframes update-banner-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}
```

- [ ] **Step 3: App.tsx に配線する**

import を追加 (既存の `import { FolderTree } ...` の直後、`useColumnResize` の import の前後どちらでも可。Biome の organizeImports に合わせる):

```ts
import { UpdateBanner } from "./components/UpdateBanner/UpdateBanner";
import { useUpdater } from "./hooks/useUpdater";
```

`App` 関数内、`useColumnResize(...)` の直後にフックを呼ぶ:

```ts
  const updater = useUpdater();
  const updaterBusy = updater.state.status === "checking" || updater.state.status === "downloading";
```

ツールバー JSX を次のように変更する。「Add Folder」ボタンの直後に「Check for Updates」ボタン、`moveError` ブロックの直後に `UpdateBanner`:

```tsx
      <div className="toolbar">
        <button type="button" className="toolbar__btn" onClick={handleAddFolder}>
          Add Folder
        </button>
        <button
          type="button"
          className="toolbar__btn"
          onClick={updater.checkNow}
          disabled={updaterBusy}
        >
          Check for Updates
        </button>
        <input
          type="text"
          className="toolbar__search"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={!selectedFavorite}
        />
        {moveError && (
          <div className="toolbar__error" role="alert">
            <span>Failed to move: {moveError}</span>
            <button
              type="button"
              className="toolbar__error-close"
              onClick={() => setMoveError(null)}
            >
              ×
            </button>
          </div>
        )}
        <UpdateBanner
          state={updater.state}
          onInstall={updater.install}
          onRestart={updater.restart}
          onRetry={updater.retry}
          onDismiss={updater.dismiss}
        />
      </div>
```

`.toolbar__btn` に `:disabled` スタイルが無いので、`global.css` の `.toolbar__btn:active` の直後に追加:

```css
.toolbar__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 4: 品質ゲート**

```bash
pnpm format && pnpm lint && pnpm test && npx tsc --noEmit
```

Expected: エラーなし。

- [ ] **Step 5: 開発モードで表示を確認する**

```bash
pnpm tauri dev
```

確認事項:
- ツールバーに「Check for Updates」ボタンが出る。
- 起動 3 秒後に何もバナーが出ない (dev ビルドは署名済みバンドルが無いので確認は失敗するが、自動確認なので非表示)。
- 「Check for Updates」を押すと一瞬「Checking for updates…」→ 赤い「Update failed: …」+ [Retry] + [×] が出る。[×] で消える。[Retry] で再度同じ結果になる。
- バナーが出ている間もツールバーが崩れない (ボタン・検索欄の位置が変わらない)。

- [ ] **Step 6: ドキュメントを更新する**

`docs/tech-stack.md` のフロントエンド依存表 (`@tauri-apps/plugin-store` の行の直後) に追加:

```md
| `@tauri-apps/plugin-updater` | GitHub Releases からのアプリ内アップデート |
| `@tauri-apps/plugin-process` | アップデート後の再起動 |
```

同ファイルの Rust 依存表 (`tauri-plugin-store` の行の直後) に追加:

```md
| `tauri-plugin-updater` | アップデータプラグイン | `latest.json` の取得・署名検証・差し替え |
| `tauri-plugin-process` | プロセス操作プラグイン | アップデート後の `relaunch` |
```

`docs/directory-structure.md`:
- `components/` に `UpdateBanner/` (`UpdateBanner.tsx  # アップデート状態バナー`) を `Icons/` の前に追加
- `hooks/` に `useUpdater.ts  # アプリ内アップデートの状態と操作` を追加
- `utils/` に `updateState.ts` / `updateState.test.ts` (`アップデート UI の状態遷移 reducer`) と `updateProgress.ts` / `updateProgress.test.ts` (`ダウンロード進捗の集計`) を追加

`CLAUDE.md` のディレクトリ構成にある `api/  # Tauri IPC ラッパー (archive, directory, favorites, settings, store)` を `(archive, directory, favorites, settings, store, updater)` にする。同じく `components/` の一覧に `UpdateBanner/  # アップデート状態バナー` を追加する。

- [ ] **Step 7: Commit**

```bash
git add src/components/UpdateBanner/UpdateBanner.tsx src/App.tsx src/styles/global.css docs/tech-stack.md docs/directory-structure.md CLAUDE.md
git commit -m "Show update banner and Check for Updates button in toolbar"
```

---

### Task 6: release.yml で updater 成果物と latest.json を配信する

**Files:**
- Modify: `.github/workflows/release.yml` (Build ステップと Upload ステップ)

**Interfaces:**
- Consumes: 「前提」で登録した GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`、Task 1 の `createUpdaterArtifacts: true`
- Produces: 各リリースに `mekuri.app.tar.gz`、`mekuri.app.tar.gz.sig`、`latest.json`、DMG が添付される

- [ ] **Step 1: Build ステップを更新する**

`--bundles dmg` を `--bundles app,dmg` にし、署名用の環境変数を追加する:

```yaml
      - name: Build
        run: pnpm tauri build --target aarch64-apple-darwin --bundles app,dmg
        env:
          # Ad-hoc sign the whole bundle. Without this only the linker's
          # ad-hoc signature is present and Gatekeeper reports the
          # downloaded app as "damaged" instead of merely unidentified.
          APPLE_SIGNING_IDENTITY: "-"
          # Sign updater artifacts (mekuri.app.tar.gz.sig) with the minisign key.
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

- [ ] **Step 2: Upload ステップを置き換える**

既存の `Upload release assets` ステップ全体を次に置き換える:

```yaml
      # tauri-action's built-in uploader cannot resolve artifact paths for
      # explicit --target builds (tauri-apps/tauri-action#243), so upload
      # the bundle to the tag's release with the gh CLI instead.
      - name: Prepare updater artifacts
        run: |
          set -euo pipefail
          bundle="src-tauri/target/aarch64-apple-darwin/release/bundle/macos"
          ls -la "$bundle"
          # Fix the asset name so latest.json can point at a stable URL.
          tarball=$(ls "$bundle"/*.app.tar.gz)
          mv "$tarball" "$bundle/mekuri.app.tar.gz"
          mv "$tarball.sig" "$bundle/mekuri.app.tar.gz.sig"

          tag="${GITHUB_REF_NAME}"
          version="${tag#v}"
          jq -n \
            --arg version "$version" \
            --arg pub_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            --arg signature "$(cat "$bundle/mekuri.app.tar.gz.sig")" \
            --arg url "https://github.com/${GITHUB_REPOSITORY}/releases/download/${tag}/mekuri.app.tar.gz" \
            '{
              version: $version,
              notes: "See the release page for details.",
              pub_date: $pub_date,
              platforms: {
                "darwin-aarch64": { signature: $signature, url: $url }
              }
            }' > "$bundle/latest.json"
          cat "$bundle/latest.json"
          jq -e '.platforms["darwin-aarch64"].signature | length > 0' "$bundle/latest.json"

      - name: Upload release assets
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          tag="${GITHUB_REF_NAME}"
          bundle="src-tauri/target/aarch64-apple-darwin/release/bundle"
          if ! gh release view "$tag" >/dev/null 2>&1; then
            gh release create "$tag" --title "$tag" --generate-notes
          fi
          gh release upload "$tag" --clobber \
            "$bundle"/dmg/*.dmg \
            "$bundle"/macos/mekuri.app.tar.gz \
            "$bundle"/macos/mekuri.app.tar.gz.sig \
            "$bundle"/macos/latest.json
          gh release edit "$tag" --draft=false
```

`set -euo pipefail` により、tar.gz が無い (updater 成果物が生成されなかった) 場合や署名が空の場合はここで失敗し、壊れた `latest.json` が公開されない。

- [ ] **Step 3: YAML の構文を検証する**

```bash
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/release.yml')); print('ok')"
```

Expected: `ok`。`yaml` モジュールが無い場合は `ruby -ryaml -e "YAML.load_file('.github/workflows/release.yml'); puts 'ok'"` で代替する。

- [ ] **Step 4: jq の生成ロジックを手元で確認する**

```bash
bundle=$(mktemp -d)
echo "dummysig" > "$bundle/mekuri.app.tar.gz.sig"
tag=v1.9.0
jq -n \
  --arg version "${tag#v}" \
  --arg pub_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg signature "$(cat "$bundle/mekuri.app.tar.gz.sig")" \
  --arg url "https://github.com/hidekingerz/mekuri/releases/download/${tag}/mekuri.app.tar.gz" \
  '{version: $version, notes: "See the release page for details.", pub_date: $pub_date, platforms: {"darwin-aarch64": {signature: $signature, url: $url}}}' \
  | tee "$bundle/latest.json"
jq -e '.platforms["darwin-aarch64"].signature | length > 0' "$bundle/latest.json" && echo VALID
```

Expected: `version` が `1.9.0`、`url` がタグ付き直リンク、最後に `VALID`。

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "Publish updater artifacts and latest.json on release"
```

---

### Task 7: ローカルでのリリースビルド確認

updater 成果物が実際に生成されるか、CI に載せる前に手元で確かめる。`createUpdaterArtifacts: true` のビルドには署名用の秘密鍵が必要なので、**開発用鍵** (`~/.tauri/mekuri-dev.key`) を使う。本番鍵は使わない。

**Files:**
- なし (検証のみ。`tauri.conf.json` の `pubkey` を一時変更した場合は必ず戻す)

- [ ] **Step 1: 開発用鍵を用意する** (Task 1 で作っていなければ)

```bash
pnpm tauri signer generate -w ~/.tauri/mekuri-dev.key -p devpass --ci
```

- [ ] **Step 2: リリースビルドを実行する**

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/mekuri-dev.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="devpass" \
APPLE_SIGNING_IDENTITY="-" \
pnpm tauri build --target aarch64-apple-darwin --bundles app,dmg
```

- [ ] **Step 3: 成果物を確認する**

```bash
ls -la src-tauri/target/aarch64-apple-darwin/release/bundle/macos/ src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/
```

Expected: `macos/` に `mekuri.app`、`mekuri.app.tar.gz`、`mekuri.app.tar.gz.sig` がある。`dmg/` に `mekuri_1.8.1_aarch64.dmg` (Task 9 の後なら 1.9.0) がある。tar.gz が無ければ `--bundles app,dmg` でも生成されないということなので、`--bundles app,dmg,updater` を試し、通った方を Task 6 の Build ステップに反映する。

- [ ] **Step 4: 署名が公開鍵で検証できることを確認する**

```bash
cat src-tauri/target/aarch64-apple-darwin/release/bundle/macos/mekuri.app.tar.gz.sig
```

Expected: `untrusted comment: signature from tauri secret key` で始まる minisign 形式のテキスト。

- [ ] **Step 5: Task 6 の Build ステップと差異が無いか見直す**

Step 3 で `--bundles` を変えた場合のみ `release.yml` を修正してコミットする:

```bash
git add .github/workflows/release.yml
git commit -m "Adjust release bundles for updater artifacts"
```

---

### Task 8: エンドツーエンド検証 (使い捨て手順)

実際に差し替えと再起動が起きるか、リリース前にローカルで確認する。設計書 6 章の手順。**GUI 操作が必要なので、人が実行する**。`tauri.conf.json` の一時変更は Step 8 で必ず戻す。

**Files:**
- 一時変更 (最後に戻す): `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`, `plugins.updater.endpoints`)

- [ ] **Step 1: tauri.conf.json を一時的にテスト設定にする**

`plugins.updater.pubkey` を `~/.tauri/mekuri-dev.key.pub` の内容に、`endpoints` を `["http://localhost:8000/latest.json"]` にする。http を使うには `dangerousInsecureTransportProtocol` も必要:

```json
  "plugins": {
    "updater": {
      "pubkey": "<DEV_PUBKEY>",
      "endpoints": ["http://localhost:8000/latest.json"],
      "dangerousInsecureTransportProtocol": true
    }
  }
```

- [ ] **Step 2: 現行バージョン (旧) をビルドしてインストールする**

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/mekuri-dev.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="devpass" \
APPLE_SIGNING_IDENTITY="-" \
pnpm tauri build --target aarch64-apple-darwin --bundles app
rm -rf /Applications/mekuri.app
cp -R src-tauri/target/aarch64-apple-darwin/release/bundle/macos/mekuri.app /Applications/
open /Applications/mekuri.app
```

Expected: 起動する。3 秒後にバナーは出ない (サーバー未起動のため自動確認が失敗するが非表示)。一度終了する。

- [ ] **Step 3: 新バージョンをビルドする**

`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` の `version` を現行 + パッチ (例: `1.8.1` → `1.8.2`、Task 9 済みなら `1.9.0` → `1.9.1`) に一時変更し、再ビルドして成果物を配信ディレクトリに集める:

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/mekuri-dev.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="devpass" \
APPLE_SIGNING_IDENTITY="-" \
pnpm tauri build --target aarch64-apple-darwin --bundles app
serve=$(mktemp -d)
cp src-tauri/target/aarch64-apple-darwin/release/bundle/macos/mekuri.app.tar.gz "$serve/"
cp src-tauri/target/aarch64-apple-darwin/release/bundle/macos/mekuri.app.tar.gz.sig "$serve/"
echo "$serve"
```

- [ ] **Step 4: latest.json を書く**

`$serve/latest.json` (`<NEW_VERSION>` は Step 3 の新バージョン):

```bash
jq -n \
  --arg version "<NEW_VERSION>" \
  --arg pub_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg signature "$(cat "$serve/mekuri.app.tar.gz.sig")" \
  --arg url "http://localhost:8000/mekuri.app.tar.gz" \
  '{version: $version, notes: "E2E test", pub_date: $pub_date, platforms: {"darwin-aarch64": {signature: $signature, url: $url}}}' \
  > "$serve/latest.json"
```

- [ ] **Step 5: 配信サーバーを起動する**

```bash
(cd "$serve" && python3 -m http.server 8000)
```

- [ ] **Step 6: 旧バージョンで更新フローを通す**

`/Applications/mekuri.app` (旧) を起動する。確認事項:
- 3 秒後に「v<NEW_VERSION> is available」+ [Update] + [×] が出る。
- [Update] → 「Downloading v<NEW_VERSION>… NN%」と進捗バーが出て、「v<NEW_VERSION> installed. Restart to finish」+ [Restart] になる。
- [Restart] → アプリが再起動し、`mekuri` メニュー → About でバージョンが新しくなっている。
- Gatekeeper に「壊れている」「開けない」と言われない。

Gatekeeper に弾かれた場合は、設計書「リスクと前提」のとおり Developer ID 署名の導入を別途検討する。この計画のスコープ外。

- [ ] **Step 7: 失敗経路も確認する**

配信サーバーを止めた状態で「Check for Updates」→ 赤い「Update failed: …」+ [Retry] + [×]。サーバーを再起動して [Retry] → バナーが `available` に戻る。

- [ ] **Step 8: 一時変更をすべて戻す**

```bash
git checkout -- src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git status
```

Expected: `git status` で作業ツリーがクリーン (Task 1 で本番 `pubkey` を入れていた場合はそれが残る。開発用鍵を入れていた場合は Task 9 で差し替える)。

---

### Task 9: バージョンを 1.9.0 にする

**Files:**
- Modify: `package.json` (`version`)
- Modify: `src-tauri/tauri.conf.json` (`version`、および `plugins.updater.pubkey` が開発用鍵なら本番鍵に差し替え)
- Modify: `src-tauri/Cargo.toml` (`version`)
- Modify: `src-tauri/Cargo.lock` (`cargo check` で自動更新)

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: 3 ファイルの version を `1.9.0` にする**

```bash
sed -i '' 's/"version": "1.8.1"/"version": "1.9.0"/' package.json src-tauri/tauri.conf.json
sed -i '' 's/^version = "1.8.1"$/version = "1.9.0"/' src-tauri/Cargo.toml
(cd src-tauri && cargo check)
git diff --stat
```

Expected: 4 ファイル (`package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`) がそれぞれ 1 行ずつ変わる。

- [ ] **Step 2: 本番公開鍵の最終確認**

```bash
grep -n pubkey src-tauri/tauri.conf.json
```

Expected: 「前提」で生成した `~/.tauri/mekuri.key.pub` の内容と一致する。開発用鍵のままなら差し替える。`dangerousInsecureTransportProtocol` が残っていないこと、`endpoints` が `https://github.com/hidekingerz/mekuri/releases/latest/download/latest.json` であることも確認する。

- [ ] **Step 3: 全品質ゲート**

```bash
(cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test)
pnpm format && pnpm lint && pnpm test && npx tsc --noEmit
```

Expected: すべてエラーなし。

- [ ] **Step 4: Commit**

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "Bump version to 1.9.0"
```

---

### Task 10: PR 作成とリリース

- [ ] **Step 1: push して PR を作る**

```bash
git push -u origin feat/in-app-updater
gh pr create --title "Add in-app updater" --body "$(cat <<'EOF'
## Summary

- Register `tauri-plugin-updater` / `tauri-plugin-process` and expose `updater:default` / `process:default`
- Add update state reducer, `useUpdater` hook, and toolbar banner (check → download → restart)
- Publish `mekuri.app.tar.gz`, `.sig`, and `latest.json` from release.yml
- Bump version to 1.9.0

## Before merging

- [ ] `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are set in GitHub Secrets
- [ ] `plugins.updater.pubkey` in `tauri.conf.json` is the production public key

## Notes

- v1.8.1 has no updater, so v1.9.0 must be installed manually from the DMG once. Auto-update works from v1.9.0 onward.
- Spec: `docs/superpowers/specs/2026-09-07-in-app-updater-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: CI 通過後にマージし、タグを打つ**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
git tag v1.9.0 && git push origin v1.9.0
```

- [ ] **Step 3: リリースの成果物を確認する**

```bash
gh release view v1.9.0 --json assets --jq '.assets[].name'
curl -sL https://github.com/hidekingerz/mekuri/releases/latest/download/latest.json | jq .
```

Expected: `mekuri_1.9.0_aarch64.dmg`、`mekuri.app.tar.gz`、`mekuri.app.tar.gz.sig`、`latest.json` の 4 件。`latest.json` の `version` が `1.9.0`、`signature` が空でない、`url` が `.../download/v1.9.0/mekuri.app.tar.gz`。

---

## Self-Review

**Spec coverage:**

| 設計書の項目 | Task |
|---|---|
| 1. 署名鍵 / Secrets | 前提 (オーナー作業) |
| 1. 成果物 (`createUpdaterArtifacts`, `--bundles app,dmg`, 署名 env) | Task 1 Step 4, Task 6 Step 1, Task 7 |
| 1. latest.json 生成と検証 (`jq -e`) | Task 6 Step 2 |
| 1. エンドポイント | Task 1 Step 4 |
| 2. アプリ側の配線 | Task 1 |
| 3. `api/updater.ts` | Task 3 |
| 3. `utils/updateState.ts` reducer + ルール | Task 2 |
| 3. `hooks/useUpdater.ts` (3 秒後自動確認、StrictMode 対策、ビューワーでは使わない) | Task 4 (`viewer.tsx` は変更しない) |
| 3. `UpdateBanner` の状態別表示 | Task 5 Step 1 |
| 3. ツールバーの「Check for Updates」ボタン (checking/downloading で disabled) | Task 5 Step 3 |
| 4. エラー処理 (自動確認は非表示、手動は Retry、relaunch 失敗は手動再起動案内) | Task 2, 4, 5 |
| 5. テスト (reducer 全遷移、`accumulateProgress`) | Task 2, 3 |
| 6. E2E 検証 | Task 8 |
| リスク: ad-hoc 署名と Gatekeeper | Task 8 Step 6 |
| リスク: `--bundles` と updater 成果物の目視確認 | Task 7 Step 3 |
| リスク: Secrets 登録がマージ前 | Task 10 PR チェックリスト |
| バージョン 1.9.0 | Task 9 |

**Type consistency:** `UpdateInfo` / `UpdateState` / `UpdateEvent` (Task 2) を Task 3〜5 が同名で参照。`DownloadProgress` (Task 3) を Task 4 の `install` が `p.downloaded` / `p.total` で参照。`UpdaterControls` (Task 4) の `checkNow` / `install` / `restart` / `retry` / `dismiss` を Task 5 の App.tsx が同名で参照。
