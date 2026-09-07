# アプリ内アップデート機能 設計書

作成日: 2026-09-07

## 目的

GitHub Releases に公開した新しいバージョンをアプリ内で検知し、ダウンロード・差し替え・再起動までをユーザー操作 1〜2 回で完了できるようにする。現在は DMG を手動でダウンロードして入れ替える必要がある。

## スコープ

- 対象プラットフォームは macOS (Apple Silicon, `darwin-aarch64`) のみ。release.yml が現在ビルドしているのもこれだけ。
- 配信は GitHub Releases の静的ファイル (`latest.json`) を使う。専用サーバーは持たない。
- Apple Developer ID による署名・公証はスコープ外。アプリは引き続き ad-hoc 署名。
- 「このバージョンをスキップ」「自動確認のオン/オフ設定」は作らない (YAGNI)。

## 方式

Tauri 公式の `tauri-plugin-updater` を使い、確認・ダウンロード・インストールはフロントエンド (JS API) から行う。再起動は `tauri-plugin-process` の `relaunch()` を使う。Rust 側の追加はプラグイン登録のみ。

Rust 主導 (Rust の updater API + `emit` で進捗通知) も検討したが、コード量が増えるだけで利点がないため採用しない。

## 1. 配信基盤 (署名と CI)

### 署名鍵

- minisign 形式の鍵ペアを `pnpm tauri signer generate -w ~/.tauri/mekuri.key` で生成する。**鍵生成はリポジトリオーナーが手元で実行する**。秘密鍵は AI セッションを経由させない。
- 公開鍵 (`mekuri.key.pub` の内容) を `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` に文字列として埋め込む (ファイルパスは不可)。
- 秘密鍵の内容とパスワードを GitHub Secrets に登録する:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### 成果物

- `tauri.conf.json` の `bundle.createUpdaterArtifacts` を `true` にする。macOS では `bundle/macos/` に `mekuri.app.tar.gz` と `mekuri.app.tar.gz.sig` が生成される。
- release.yml のビルドを `--bundles app,dmg` にする。`app` を明示するのは、`dmg` 単独指定で updater 成果物が生成されるかが公式ドキュメントで明言されていないため。初回のリリースビルドで成果物の有無を確認する。
- 署名用の環境変数を Build ステップの `env` に追加する。

### latest.json

release.yml の Upload ステップで jq を使って生成し、DMG・tar.gz・sig と一緒にリリースに添付する。

```json
{
  "version": "1.9.0",
  "notes": "See the release page for details.",
  "pub_date": "2026-09-07T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<mekuri.app.tar.gz.sig の内容>",
      "url": "https://github.com/hidekingerz/mekuri/releases/download/v1.9.0/mekuri.app.tar.gz"
    }
  }
}
```

- `version` はタグから `v` を除いた文字列。
- `url` はそのタグのリリースに添付した tar.gz の直リンク。tar.gz のファイル名にバージョンやスペースが含まれる場合は、アップロード前に `mekuri.app.tar.gz` にリネームして URL を固定する。
- `notes` は固定文言でよい。リリースノートは GitHub の `--generate-notes` に任せる。

### エンドポイント

`tauri.conf.json` の `plugins.updater.endpoints` は 1 件のみ:

```
https://github.com/hidekingerz/mekuri/releases/latest/download/latest.json
```

GitHub が最新リリースの添付ファイルへリダイレクトするので、バージョンごとの URL 更新は不要。プレリリースは「最新」に含まれないので、プレリリースを作っても配信されない。

## 2. アプリ側の配線

- `src-tauri/Cargo.toml`: `tauri-plugin-updater = "2"`、`tauri-plugin-process = "2"` を追加。
- `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_updater::Builder::new().build())` と `.plugin(tauri_plugin_process::init())` を登録。
- `src-tauri/capabilities/default.json`: `updater:default` と `process:default` を追加。
- `package.json`: `@tauri-apps/plugin-updater`、`@tauri-apps/plugin-process` を追加。
- `tauri.conf.json`: 上記の `createUpdaterArtifacts`、`plugins.updater.pubkey`、`plugins.updater.endpoints`。

## 3. フロントエンド

### `src/api/updater.ts`

Tauri プラグインの薄いラッパー。React には依存しない。

```ts
export type AvailableUpdate = { version: string; notes: string | null };
export type DownloadProgress = { downloaded: number; total: number | null };

export async function checkForUpdate(): Promise<AvailableUpdate | null>;
export async function downloadAndInstall(onProgress: (p: DownloadProgress) => void): Promise<void>;
export async function relaunch(): Promise<void>;
```

- `checkForUpdate` は `check()` の戻り値を保持し、`downloadAndInstall` はその保持した `Update` オブジェクトに対して呼ぶ (プラグインの `Update` は `check()` の結果に紐づくため、モジュール内に保持する)。
- 進捗は `Started` で `total`、`Progress` で `downloaded` を累積して通知する。

### `src/utils/updateState.ts`

状態遷移を純粋関数 (reducer) として定義し、Vitest で検証する。

状態:

| state | 付随データ |
|---|---|
| `idle` | なし |
| `checking` | `manual: boolean` (手動確認かどうか) |
| `upToDate` | なし (手動確認で最新だったとき。数秒後に `idle` へ) |
| `available` | `version`, `notes` |
| `downloading` | `version`, `downloaded`, `total` |
| `ready` | `version` (インストール済み、再起動待ち) |
| `error` | `message`, `retry: "check" \| "install" \| null`, `update?` (install 失敗時に元の `available` 情報を保持) |

イベント: `CHECK_STARTED(manual)`, `CHECK_FOUND(update)`, `CHECK_NONE`, `CHECK_FAILED(message)`, `DOWNLOAD_STARTED`, `DOWNLOAD_PROGRESS(downloaded, total)`, `DOWNLOAD_FINISHED`, `DOWNLOAD_FAILED(message)`, `DISMISS`。

ルール:

- 自動確認 (`manual: false`) の `CHECK_FAILED` と `CHECK_NONE` は `idle` に戻る (何も表示しない)。
- 手動確認の `CHECK_NONE` は `upToDate`、`CHECK_FAILED` は `error` (`retry: "check"`)。
- `DOWNLOAD_FAILED` は `error` (`retry: "install"`、`update` に直前の `available` 情報を保持)。
- `DISMISS` は `available`、`upToDate`、`error` を `idle` に戻す。`downloading` と `ready` では無視する。
- `downloading` 中の `CHECK_STARTED` は無視する (二重実行防止)。

### `src/hooks/useUpdater.ts`

`useReducer` で上記 reducer を使い、`api/updater.ts` を呼ぶ。公開するもの:

- `state`
- `checkNow()`: 手動確認
- `install()`: ダウンロードとインストール
- `restart()`: `relaunch()`
- `dismiss()`

メインウィンドウのマウントから 3 秒後に自動確認を 1 回だけ行う (`useEffect`、Strict Mode の二重実行は `useEffect` のクリーンアップでタイマーを `clearTimeout` することで 1 回に抑える (フラグは持たない))。ビューワーウィンドウ (`viewer.tsx`) ではこのフックを使わない。

### `src/components/UpdateBanner/UpdateBanner.tsx`

ツールバー右側 (既存の `toolbar__error` と同じ位置) に表示する。状態ごとの表示:

- `checking` (手動のみ): 「Checking for updates…」
- `upToDate`: 「You're up to date」(3 秒で自動的に消える)
- `available`: 「v1.9.0 is available」+ [Update] + [×]
- `downloading`: 「Downloading v1.9.0… 45%」+ 進捗バー (total 不明なら不定表示)
- `ready`: 「v1.9.0 installed. Restart to finish」+ [Restart]
- `error`: 「Update failed: <message>」+ [Retry] (`retry` が null 以外のとき) + [×]

`idle` と自動確認中の `checking` は何も描画しない。`toolbar__error` の既存スタイルを流用し、`update-banner` クラスで色を変える (エラー時のみ赤系、それ以外は中立色)。

### ツールバー

「Add Folder」の隣に「Check for Updates」ボタンを追加する。`checking` と `downloading` の間は disabled。

## 4. エラー処理

- 起動時の自動確認は失敗しても何も表示しない。オフラインや `pnpm tauri dev` (署名済みバンドルがなく必ず失敗する) で毎回エラーが出るのを避けるため。
- 手動確認の失敗はバナーにメッセージと [Retry] を出す。
- ダウンロード・インストールの失敗はバナーにメッセージと [Retry] を出す。Retry は保持した `update` で `available` に戻し、再度 [Update] を押せる状態にする。
- 署名検証失敗はプラグインがエラーとして返すので、上記と同じ経路で表示される。
- `relaunch()` の失敗はほぼ起きないが、起きた場合は `error` (`retry: null`) にして「Please restart mekuri manually」と出す。

## 5. テスト

- `src/utils/updateState.test.ts`: reducer の全遷移を Vitest で検証する。特に「自動確認の失敗は idle に戻る」「downloading 中の DISMISS と CHECK_STARTED は無視」を押さえる。
- `src/api/updater.ts` の進捗集計 (Started/Progress イベント → `DownloadProgress`) は純粋関数 `accumulateProgress` に切り出して Vitest で検証する。
- Rust 側はプラグイン登録のみで `cargo clippy` と既存テストが通ればよい。
- CI: release.yml で `latest.json` 生成後に `jq -e '.platforms["darwin-aarch64"].signature | length > 0'` で中身を検証してから添付する。

## 6. エンドツーエンド検証 (使い捨て手順)

実際に差し替えと再起動が起きるか、リリース前にローカルで確認する。

1. テスト用の鍵ペアを別途生成する (`~/.tauri/mekuri-test.key`)。
2. `tauri.conf.json` の `pubkey` をテスト公開鍵に、`endpoints` を `http://localhost:8000/latest.json` に一時的に書き換える。
3. `version` を `1.9.0` のままビルドし、生成された `.app` を `/Applications` 相当の場所にコピーして起動できることを確認する。
4. `version` を `1.9.1` に変えて再ビルドし、`mekuri.app.tar.gz` と `.sig` を取り出す。テスト秘密鍵で署名されていることを確認する。
5. `latest.json` を手で書き、`python3 -m http.server 8000` で tar.gz と一緒に配信する。
6. 1.9.0 のアプリを起動し、バナー → [Update] → [Restart] の流れで 1.9.1 が起動することを確認する。Gatekeeper に弾かれないかもここで見る。
7. `tauri.conf.json` の一時変更をすべて戻す。

## リスクと前提

- **ad-hoc 署名と Gatekeeper**: updater が差し替えた `.app` は quarantine 属性を持たないので通常は起動できるはずだが、上記 6 の手順で必ず確認する。弾かれた場合は Developer ID 署名の導入を別途検討する。
- **初回は手動**: 現行の v1.8.1 には updater が入っていないので、v1.9.0 だけは DMG の手動インストールが必要。自動更新が効くのは v1.9.0 以降。
- **`--bundles dmg` と updater 成果物**: `app` を明示して回避するが、初回のリリースビルドでは成果物の一覧を目視確認する。
- **GitHub Secrets の登録**: 鍵の登録が済むまでリリースビルドは署名エラーで失敗する。マージ前に登録を済ませる。

## バージョン

機能追加なので 1.9.0 とする。
