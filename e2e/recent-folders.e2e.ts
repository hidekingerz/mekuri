import { expect, test } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

test.use({
  mockOptions: {
    recentFolders: [
      {
        folder: "/m/manga/作者A/完結/シリーズX",
        file: "/m/manga/作者A/完結/シリーズX/x3.zip",
        openedAt: now - DAY,
      },
      {
        folder: "/m/manga/消えたフォルダ",
        file: "/m/manga/消えたフォルダ/a.zip",
        openedAt: now - 2 * DAY,
      },
      { folder: "/m/mag/月刊Y", file: "/m/mag/月刊Y/y2.pdf", openedAt: now - 3 * DAY },
      { folder: "/elsewhere/Z", file: "/elsewhere/Z/z.zip", openedAt: now - 4 * DAY },
    ],
  },
});

test.describe("最近開いたフォルダ", () => {
  test("何も選んでいないときに一覧を出し、無いフォルダとお気に入りの外は出さない", async ({
    main,
  }) => {
    const names = main.page.locator(".recent-folders__name");
    await expect(names).toHaveText(["シリーズX", "月刊Y"]);
    const first = main.page.locator(".recent-folders__item").first();
    await expect(first).toContainText("x3.zip を開いていました");
    await expect(first).toContainText("manga › 作者A › 完結 › シリーズX");
    await expect(first.locator(".recent-folders__when")).toHaveText("昨日");
    await expect(
      main.page.getByText("お気に入りやフォルダを選ぶと、ここにファイルの一覧が出ます"),
    ).toBeVisible();
  });

  test("選ぶと、そのお気に入りに切り替わり、ツリーが開いて中身が出る", async ({ main }) => {
    await main.page.locator(".recent-folders__item").first().click();
    await expect(main.favorite("manga")).toHaveClass(/favorites-sidebar__item--selected/);
    await expect(main.selectedTreeNodes()).toHaveText(["シリーズX"]);
    await expect(main.fileNames()).toHaveText(["x1.zip", "x2.zip", "x3.zip"]);
  });

  test("フォルダの表示中は「最近」ボタンから開き、Esc・外側のクリック・選択で閉じる", async ({
    main,
  }) => {
    await main.page.locator(".recent-folders__item").first().click();
    await expect(main.file("x1.zip")).toBeVisible();
    const button = main.page.getByRole("button", { name: "最近", exact: true });
    const popover = main.page.getByRole("dialog", { name: "最近開いたフォルダ" });

    await button.click();
    // 表示中のフォルダ（シリーズX）は出さない
    await expect(popover.locator(".recent-folders__name")).toHaveText(["月刊Y"]);
    await main.page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.click();
    await button.focus();
    await main.page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);

    await button.click();
    await main.page.locator(".file-list__items").click({ position: { x: 20, y: 300 } });
    await expect(popover).toHaveCount(0);

    await button.click();
    await popover.locator(".recent-folders__item").click();
    await expect(popover).toHaveCount(0);
    await expect(main.selectedTreeNodes()).toHaveText(["月刊Y"]);
  });
});

test.describe("ビューワーで開いたときの記録", () => {
  test.use({ mockOptions: { recentFolders: [] } });

  test("開いたファイルのフォルダを記録し、メインウィンドウでの移動では記録しない", async ({
    main,
    page,
    context,
  }) => {
    await main.favorite("mag").click();
    await main.treeNode("月刊Y").click();
    await expect(main.file("y1.pdf")).toBeVisible();
    expect((await main.calls("plugin:store|set")).filter((c) => c.key === "recentFolders")).toEqual(
      [],
    );

    const viewer = await context.newPage();
    const { openWithMock } = await import("./helpers");
    await openWithMock(
      viewer,
      `/viewer.html?archive=${encodeURIComponent("/m/manga/作者B/b1.zip")}`,
      { recentFolders: [] },
      "viewer-1",
    );
    await expect
      .poll(() =>
        viewer.evaluate(
          () =>
            (
              window as unknown as {
                __MOCK_STORE__: { recentFolders: { folder: string; file: string }[] };
              }
            ).__MOCK_STORE__.recentFolders[0],
        ),
      )
      .toMatchObject({ folder: "/m/manga/作者B", file: "/m/manga/作者B/b1.zip" });
    await viewer.close();
    await expect(page).toHaveURL(/index\.html/);
  });
});
