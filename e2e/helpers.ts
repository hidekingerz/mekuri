import { readFileSync } from "node:fs";
import { test as base, expect, type Locator, type Page } from "@playwright/test";

const mockSource = readFileSync(new URL("./tauri-mock.js", import.meta.url), "utf8");

/** tauri-mock.js の初期値。 */
export type MockOptions = {
  tree?: Record<string, string[]>;
  favorites?: string[];
  recentFolders?: { folder: string; file: string; openedAt: number }[];
  fail?: Record<string, string>;
  monitor?: null;
  /** 保存済みのビューワーの設定（無ければ既定で開く） */
  viewerSettings?: { width: number; height: number; viewMode?: string; readingDirection?: string };
  /** アーカイブのパス → ページ（名前、画像の幅、高さ）。無いパスは縦長 10 ページ */
  archives?: Record<string, [string, number, number][]>;
};

type Call = { cmd: string; args: Record<string, unknown> };

/** メインウィンドウの操作と、モックの中身の読み取り。 */
export class MainWindow {
  constructor(readonly page: Page) {}

  favorite = (name: string) => this.page.locator(".favorites-sidebar__item", { hasText: name });
  treeNode = (name: string) =>
    this.page.locator('[aria-label="フォルダツリー"] .tree-node', {
      has: this.page.locator(".tree-node__name", { hasText: new RegExp(`^${name}$`) }),
    });
  selectedTreeNodes = () => this.page.locator(".tree-node--selected .tree-node__name");
  file = (name: string) => this.page.locator(`.file-list__item[data-path$="/${name}"]`);
  fileAt = (path: string) => this.page.locator(`.file-list__item[data-path="${path}"]`);
  fileNames = () => this.page.locator(".file-list__item[data-path] .file-list__name");
  dialog = () => this.page.locator("dialog.confirm-dialog");
  menuItem = (text: string) => this.page.locator(".context-menu__item", { hasText: text });
  alerts = () => this.page.getByRole("alert");
  searchBox = () => this.page.getByLabel("フォルダとファイルを検索");
  /** 検索中に真ん中の列に出る、一致したフォルダの行 */
  matchedFolder = (name: string) =>
    this.page.locator('[aria-label="検索に一致したフォルダ"] .tree-node', { hasText: name });
  /** 検索中に右の列に出る、フォルダの行 */
  resultFolder = (name: string) =>
    this.page.locator(".file-list__item:not([data-path])", { hasText: name });

  async selectedFiles(): Promise<string[]> {
    return this.page
      .locator('.file-list__item[aria-selected="true"]')
      .evaluateAll((els) =>
        els.map((el) => (el as HTMLElement).dataset.path?.split("/").pop() ?? ""),
      );
  }

  async calls(cmd: string): Promise<Record<string, unknown>[]> {
    return this.page.evaluate(
      (c) =>
        (window as unknown as { __MOCK_CALLS__: Call[] }).__MOCK_CALLS__
          .filter((x) => x.cmd === c)
          .map((x) => x.args),
      cmd,
    );
  }

  /** ビューワーを開く呼び出し。開いたファイル名と、指定された位置。 */
  async openedViewers(): Promise<{ name: string; x?: number; y?: number }[]> {
    const created = await this.calls("plugin:webview|create_webview_window");
    return created.map((c) => {
      const options = c.options as { url: string; x?: number; y?: number };
      return {
        name: decodeURIComponent(options.url).split("/").pop() ?? "",
        x: options.x,
        y: options.y,
      };
    });
  }

  async folderContents(dir: string): Promise<string[] | undefined> {
    return this.page.evaluate(
      (d) => (window as unknown as { __MOCK_FS__: Record<string, string[]> }).__MOCK_FS__[d],
      dir,
    );
  }

  async favorites(): Promise<string[]> {
    return this.page.evaluate(
      () =>
        (window as unknown as { __MOCK_STORE__: { favorites: string[] } }).__MOCK_STORE__.favorites,
    );
  }

  /** 仮のファイルツリーにフォルダを足す（Finder 側のフォルダなど）。 */
  async addFolder(dir: string, children: string[]) {
    await this.page.evaluate(
      ([d, c]) => {
        (window as unknown as { __MOCK_FS__: Record<string, string[]> }).__MOCK_FS__[d as string] =
          c as string[];
      },
      [dir, children] as const,
    );
  }

  /** 別のウィンドウでファイルが消えたことを再現する。 */
  async trashedElsewhere(dir: string, name: string) {
    await this.page.evaluate(
      ([d, n]) => {
        const w = window as unknown as {
          __MOCK_FS__: Record<string, string[]>;
          __MOCK_EMIT__: (event: string) => void;
        };
        w.__MOCK_FS__[d] = w.__MOCK_FS__[d].filter((c) => c !== n);
        w.__MOCK_EMIT__("file-trashed");
      },
      [dir, name] as const,
    );
  }

  /**
   * Finder からのドロップを再現する。ドラッグ用ペーストボードの中身（paths）をモックに置き、
   * File を載せた dragover / drop を target に届ける。
   */
  async finderDrop(
    target: Locator,
    paths: string[],
    { names = paths.map((p) => p.split("/").pop() ?? ""), events = ["dragover", "drop"] } = {},
  ) {
    await this.page.evaluate((d) => {
      (window as unknown as { __MOCK_DRAGGED__: string[] }).__MOCK_DRAGGED__ = d;
    }, paths);
    await target.evaluate(
      (el, [fileNames, types]) => {
        const dt = new DataTransfer();
        for (const n of fileNames) dt.items.add(new File(["x"], n));
        for (const type of types) {
          el.dispatchEvent(
            new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }),
          );
        }
      },
      [names, events] as const,
    );
  }

  /** お気に入り manga の「作者A」（a1.zip〜a5.pdf の 5 ファイル）を開く。 */
  async openAuthorA() {
    await this.favorite("manga").click();
    await this.treeNode("作者A").click();
    await expect(this.file("a1.zip")).toBeVisible();
  }

  /** ツリーのフォルダを右クリックして「ゴミ箱に移動」を選び、確認が出るまで待つ。 */
  async askToTrashFolder(name: string) {
    await this.treeNode(name).click({ button: "right" });
    await this.menuItem("ゴミ箱に移動").click();
    await expect(this.dialog()).toBeVisible();
  }

  confirmTrash = () => this.dialog().getByRole("button", { name: "ゴミ箱に移動" }).click();
  cancelTrash = () => this.dialog().getByRole("button", { name: "キャンセル" }).click();
}

/** 縦長と横長のページの大きさ（幅、高さ）。 */
export const PORTRAIT: [number, number] = [700, 1000];
export const LANDSCAPE: [number, number] = [1400, 1000];

/** ページの大きさの並びから、モックに渡すアーカイブの中身を作る。 */
export function pagesOf(sizes: [number, number][]): [string, number, number][] {
  return sizes.map(([w, h], i) => [`${String(i + 1).padStart(3, "0")}.jpg`, w, h]);
}

/** ビューワーウィンドウの操作と読み取り。 */
export class ViewerWindow {
  constructor(readonly page: Page) {}

  /** 「2 / 6」のような位置の表示 */
  position = () => this.page.locator(".spread-viewer__info");
  progress = () => this.page.getByRole("progressbar");
  directionButton = () => this.page.locator('button[aria-label^="読み方向"]');
  dialog = () => this.page.locator("dialog.confirm-dialog");
  button = (name: string) => this.page.getByRole("button", { name, exact: true });

  /** 画面に出ているページ番号を、左から右の順で返す。 */
  async shownPages(): Promise<number[]> {
    const cells = await this.page.locator(".spread-viewer__cell").evaluateAll((els) =>
      els.map((el) => {
        const img = el.querySelector("img");
        return {
          x: el.getBoundingClientRect().x,
          n: img ? Number.parseInt(img.alt, 10) : Number.NaN,
        };
      }),
    );
    return cells.sort((a, b) => a.x - b.x).map((c) => c.n);
  }

  /** 画像の読み込みと組み直しが落ち着いたあとの、画面のページ番号。 */
  async settledPages(): Promise<number[]> {
    let last = "";
    await expect
      .poll(
        async () => {
          const now = JSON.stringify(await this.shownPages());
          const stable = now === last && !now.includes("null");
          last = now;
          return stable;
        },
        { intervals: [150] },
      )
      .toBe(true);
    return this.shownPages();
  }

  async title(): Promise<string | undefined> {
    return this.page.evaluate(() => {
      const calls = (window as unknown as { __MOCK_CALLS__: Call[] }).__MOCK_CALLS__;
      const last = calls.filter((c) => c.cmd === "plugin:window|set_title").pop();
      return last?.args.value as string | undefined;
    });
  }

  async savedSettings(): Promise<Record<string, unknown> | undefined> {
    return this.page.evaluate(
      () =>
        (window as unknown as { __MOCK_STORE__: { viewerSettings?: Record<string, unknown> } })
          .__MOCK_STORE__.viewerSettings,
    );
  }

  /** ページ領域の左半分か右半分をクリックする。 */
  async clickHalf(side: "left" | "right") {
    const box = await this.page.locator(".spread-viewer__pages").boundingBox();
    if (!box) throw new Error("pages area is not visible");
    const x = box.x + box.width * (side === "left" ? 0.25 : 0.75);
    await this.page.mouse.click(x, box.y + box.height / 2);
  }

  /** プログレスバーの、左端からの割合の位置をクリックする。 */
  async clickProgress(fromLeft: number) {
    const box = await this.progress().boundingBox();
    if (!box) throw new Error("progress bar is not visible");
    await this.page.mouse.click(box.x + box.width * fromLeft, box.y + box.height / 2);
  }

  /** 短い間隔で wheel を続けて届ける（トラックパッドの慣性を模す）。 */
  async wheelBurst(count: number, intervalMs: number, deltaY = 120) {
    await this.page.evaluate(
      async ([n, interval, dy]) => {
        for (let i = 0; i < n; i++) {
          window.dispatchEvent(
            new WheelEvent("wheel", { deltaY: dy, bubbles: true, cancelable: true }),
          );
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      },
      [count, intervalMs, deltaY] as const,
    );
  }
}

/** ビューワーで開くファイルの既定（モックの作者A の 1 冊目）。 */
export const VIEWER_FILE = "/m/manga/作者A/a1.zip";

type Fixtures = {
  /** モックの初期値。test.use({ mockOptions: {...} }) で変える */
  mockOptions: MockOptions;
  /** モックを入れて開いたメインウィンドウ */
  main: MainWindow;
  /** モックを入れて VIEWER_FILE を開いたビューワーウィンドウ */
  viewer: ViewerWindow;
  /** コンソールのエラーを集め、テストの終わりに 1 件でもあれば失敗させる */
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  mockOptions: [{}, { option: true }],
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      page.on("console", (msg) => {
        // favicon はブラウザが勝手に取りに行くもので、アプリには無い
        if (msg.type() === "error" && !/favicon|404/.test(msg.text())) errors.push(msg.text());
      });
      await use(errors);
      expect(errors, "コンソールにエラーが出ていないこと").toEqual([]);
    },
    { auto: true },
  ],
  main: async ({ page, mockOptions }, use) => {
    await openWithMock(page, "/index.html", mockOptions);
    await expect(page.locator(".favorites-sidebar__item").first()).toBeVisible();
    await use(new MainWindow(page));
  },
  viewer: async ({ page, mockOptions }, use) => {
    const url = `/viewer.html?archive=${encodeURIComponent(VIEWER_FILE)}`;
    await openWithMock(page, url, mockOptions, "viewer-1");
    await expect(page.locator(".spread-viewer__info")).toBeVisible();
    await use(new ViewerWindow(page));
  },
});

/** モックを注入してからページを開く。label はウィンドウのラベル（ビューワーは "viewer-…"）。 */
export async function openWithMock(
  page: Page,
  url: string,
  options: MockOptions = {},
  label = "main",
) {
  await page.addInitScript(
    ([opts, windowLabel]) => {
      const w = window as unknown as { __MOCK_OPTS__: unknown; __MOCK_LABEL__: string };
      w.__MOCK_OPTS__ = opts;
      w.__MOCK_LABEL__ = windowLabel;
    },
    [options, label] as const,
  );
  await page.addInitScript(mockSource);
  await page.goto(url);
}

export { expect };
