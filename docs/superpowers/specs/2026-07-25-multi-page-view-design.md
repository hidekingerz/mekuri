# 表示モード拡張（3ページ見開き・ウィンドウサイズ追従）設計

- 日付: 2026-07-25
- 対象 Issue: [#30 PDFモードに、横連続表示を追加](https://github.com/hidekingerz/mekuri/issues/30)
- 対象ブランチ: `feat/multi-page-view`（`main` = Tauri/Rust 版ベース）

## 背景と目的

楽譜などの PDF をウルトラワイドディスプレイで閲覧する際、見開き（2ページ）では画面幅を活かしきれない。
画面サイズに応じてより多くのページを横に並べて表示できるようにする。

## 要件

- 表示モードを 4 つにする: 単ページ / 見開き / **3ページ見開き** / **ウィンドウサイズ追従見開き**
- 新モードは **PDF・アーカイブ（ZIP/RAR）共通**で利用できる
- デフォルトは従来どおり見開き（`spread`）。PDF の既定読み方向 LTR / アーカイブ RTL も変更しない
- モード切替はフッターのボタンと右クリックメニューの両方から行える
- 新モード（3ページ・追従）では表紙の単独表示は行わず、1 ページ目から詰めて並べる
  （3ページ: 1-2-3, 4-5-6, … / 追従: N 枚ずつ）
- ウィンドウサイズ追従モードは、ページの縦横比とウィンドウの縦横比から
  「高さいっぱいに表示したとき横に収まる枚数 N」を自動計算して N ページ並べる。
  リサイズ時は N を再計算する。ページ送りは N ページ単位
- Rust（`src-tauri`）側の変更はなし（表示ロジックはすべてフロントエンド）

## データモデル（`src/utils/spreadLayout.ts`）

`Spread = { right, left }` を廃止し、読み順のページ index 配列に一般化する。

```ts
export type ViewMode = "single" | "spread" | "triple" | "fit";
export type PageGroup = number[]; // 読み順のページ index（0-based）

// 例: buildPageGroups(7, "spread")  → [[0], [1,2], [3,4], [5,6]]
//     buildPageGroups(7, "triple")  → [[0,1,2], [3,4,5], [6]]
//     buildPageGroups(7, "fit", 4)  → [[0,1,2,3], [4,5,6]]
export function buildPageGroups(
  totalPages: number,
  mode: ViewMode,
  fitPageCount?: number, // fit モード時の 1 グループ枚数 N（既定 2）
): PageGroup[];

export function groupIndexForPage(groups: PageGroup[], pageIndex: number): number;
export function currentPageFromGroup(group: PageGroup): number; // 読み順の先頭

// fit モードの枚数計算（純関数）
// N = max(1, floor(containerWidth / (containerHeight * pageAspect)))
// N が総ページ数を超える場合は buildPageGroups が 1 グループにまとめる
export function computeFitPageCount(
  containerWidth: number,
  containerHeight: number,
  pageAspect: number, // ページの 幅/高さ 比
): number;
```

- `single` = 1 枚組、`spread` = 表紙単独 + 2 枚組（現行と同じ分割）、
  `triple` = 3 枚組（表紙単独なし）、`fit` = N 枚組（表紙単独なし）
- RTL/LTR はデータに持たせず、レンダリング時に並び順を反転するだけにする
  （現行の Spread 構築時に left/right を振る方式は廃止）

## SpreadViewer（`src/components/SpreadViewer/SpreadViewer.tsx`）

- `rightSrc` / `leftSrc` の 2 状態を `srcs: (string | null)[]`
  （グループ内ページの data URL 配列）に置き換え。グループ全ページを `Promise.all` でロード
- 表示は flexbox のまま、グループ内ページを `isRtl ? 逆順 : 正順` で横に並べる。
  既存の `__half` スタイルは N 等分セル用の `__cell` に整理する
- クリックナビゲーションは現行どおり画面の左半分/右半分クリックで前後移動
  （セル単位ではなく画面半分で判定）
- **fit モード**: コンテナに `ResizeObserver` を付け、`computeFitPageCount` で N を再計算。
  ページ縦横比は最初に表示したページ画像の naturalWidth/naturalHeight から取得し、
  取得前は A4 縦（0.707）を仮定する。N が変化したら現在ページ位置を保持したまま
  グループを再構築する（`groupIndexForPage` で位置を引き直す）
- キーボード（← → / Space / Home / End）・マウスホイール・プログレスバー・
  ウィンドウタイトルの `[n/total]` 表記はグループ単位でそのまま動作（変更なし）
- `SpreadViewerHandle` の `toggleViewMode()` を `setViewMode(mode: ViewMode)` に変更
  （読み方向トグル `toggleReadingDirection()` は現状維持）

## UI

- **フッター**: 現行の 1 トグルボタンを廃止し、モードごとのアイコンボタンを 4 つ並べる。
  アクティブなモードは `--active` クラスでハイライト。
  `Icons.tsx` に `TriplePageIcon`（縦棒 3 本）と `FitWindowIcon`（左右矢印 + 枠）を追加
  （既存の `SinglePageIcon` / `SpreadViewIcon` は流用）
- **右クリックメニュー**（`ViewerApp.tsx`）: 現行の「見開き/単ページ」トグル 1 項目を、
  Tauri の `CheckMenuItem` による 4 項目
  （単ページ表示 / 見開き表示 / 3ページ表示 / ウィンドウ追従表示、現在モードにチェック）に置き換え

## 設定の永続化と互換性

- `viewerSettings.viewMode` に `"triple"` / `"fit"` をそのまま保存
  （`saveViewerSettings` の既存フロー）。旧値 `"spread"` / `"single"` はそのまま有効なので
  移行処理は不要
- fit モードの N は保存しない（ウィンドウサイズから毎回導出する）

## テスト

- `spreadLayout.test.ts` を新 API で書き直す:
  - 4 モードそれぞれのグループ分割（0 / 1 / 2 ページ・端数ページの境界を含む）
  - `groupIndexForPage` / `currentPageFromGroup`
  - `computeFitPageCount`（縦長ウィンドウ → 1、21:9 → 4、ゼロ・負サイズ → 1 などの境界）
- Rust 側の変更はないため `cargo test` は現状維持で通ること

## エラーハンドリング

- ページ画像ロード失敗時は現行どおり `loadError` を表示（グループ内のいずれかが失敗したら
  エラー表示）。挙動の変更はしない

## 作業フロー

- `main` から `feat/multi-page-view` を作成し、PR は `main` 向け
- コミット前の品質ゲート: `pnpm format` / `pnpm lint` / `pnpm test` / `npx tsc --noEmit`
  （Rust 変更はないが CI で `cargo test` 等が走る）
