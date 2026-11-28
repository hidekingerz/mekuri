import { CASCADE_STEP } from "../src/utils/windowCascade";
import { expect, test } from "./helpers";

test.describe("ファイル一覧の選択", () => {
  test("クリックした 1 件だけが選ばれる", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a2.zip").click();
    expect(await main.selectedFiles()).toEqual(["a2.zip"]);
    await main.file("a4.cbz").click();
    expect(await main.selectedFiles()).toEqual(["a4.cbz"]);
  });

  test("↑↓ で選択が移り、移した先が範囲選択の起点になる", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.page.keyboard.press("ArrowDown");
    expect(await main.selectedFiles()).toEqual(["a2.zip"]);
    await main.page.keyboard.press("ArrowDown");
    await main.page.keyboard.press("ArrowUp");
    expect(await main.selectedFiles()).toEqual(["a2.zip"]);
    await main.file("a4.cbz").click({ modifiers: ["Shift"] });
    expect(await main.selectedFiles()).toEqual(["a2.zip", "a3.zip", "a4.cbz"]);
  });

  test("Shift+クリックは、起点からその項目までの範囲に置き換える", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a4.cbz").click({ modifiers: ["Shift"] });
    expect(await main.selectedFiles()).toEqual(["a1.zip", "a2.zip", "a3.zip", "a4.cbz"]);
    await main.file("a2.zip").click({ modifiers: ["Shift"] });
    expect(await main.selectedFiles()).toEqual(["a1.zip", "a2.zip"]);
  });

  test("Cmd+クリックでトグルし、Esc で解除する", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a3.zip").click({ modifiers: ["Meta"] });
    expect(await main.selectedFiles()).toEqual(["a1.zip", "a3.zip"]);
    await main.file("a3.zip").click({ modifiers: ["Meta"] });
    expect(await main.selectedFiles()).toEqual(["a1.zip"]);
    await main.page.keyboard.press("Escape");
    expect(await main.selectedFiles()).toEqual([]);
  });

  test("起点が一覧から消えたあとは、次の Shift 操作の項目が新しい起点になる", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a2.zip").click();
    await main.file("a2.zip").dragTo(main.treeNode("作者B"));
    await expect(main.file("a2.zip")).toHaveCount(0);
    await main.file("a3.zip").click({ modifiers: ["Shift"] });
    expect(await main.selectedFiles()).toEqual(["a3.zip"]);
    await main.file("a5.pdf").click({ modifiers: ["Shift"] });
    expect(await main.selectedFiles()).toEqual(["a3.zip", "a4.cbz", "a5.pdf"]);
  });
});

test.describe("Enter で開く", () => {
  test("1 件のときは、位置を指定せずにビューワーを開く", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a3.zip").click();
    await main.page.keyboard.press("Enter");
    await expect.poll(() => main.openedViewers()).toEqual([{ name: "a3.zip" }]);
  });

  test("複数のときは選択中をすべて開き、ウィンドウを右下へずらして並べる", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a3.zip").click({ modifiers: ["Shift"] });
    await main.page.keyboard.press("Enter");
    await expect.poll(async () => (await main.openedViewers()).length).toBe(3);

    const viewers = await main.openedViewers();
    expect(viewers.map((v) => v.name)).toEqual(["a1.zip", "a2.zip", "a3.zip"]);
    const [first, second, third] = viewers as { x: number; y: number }[];
    expect([second.x - first.x, second.y - first.y]).toEqual([CASCADE_STEP, CASCADE_STEP]);
    expect([third.x - second.x, third.y - second.y]).toEqual([CASCADE_STEP, CASCADE_STEP]);
    // モックの画面は論理 1600x1000（作業領域は y=25 から）、ビューワーの既定は 1200x900
    expect(first.x).toBeGreaterThanOrEqual(0);
    expect(first.y).toBeGreaterThanOrEqual(25);
    expect(third.x + 1200).toBeLessThanOrEqual(1600);
    expect(third.y + 900).toBeLessThanOrEqual(1025);
  });

  test("選択から外した項目や、解除したあとは開かない", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a3.zip").click({ modifiers: ["Meta"] });
    await main.file("a3.zip").click({ modifiers: ["Meta"] });
    await main.page.keyboard.press("Enter");
    await expect.poll(() => main.openedViewers()).toEqual([{ name: "a1.zip" }]);

    await main.page.keyboard.press("Escape");
    await main.page.keyboard.press("Enter");
    await main.page.waitForTimeout(200);
    expect(await main.openedViewers()).toHaveLength(1);
  });
});

test.describe("ファイル一覧の並び順", () => {
  test("変えた並び順を保存して、開いているビューワーへ知らせる", async ({ main }) => {
    await main.openAuthorA();
    await main.page.getByLabel("並び順").selectOption("更新日時");
    await expect.poll(() => main.savedFileSort()).toEqual({ key: "modified", direction: "asc" });
    await main.page.getByRole("button", { name: "昇順。クリックで降順" }).click();
    await expect.poll(() => main.savedFileSort()).toEqual({ key: "modified", direction: "desc" });
    await expect
      .poll(async () => (await main.emitted()).filter((e) => e === "file-sort-changed"))
      .toHaveLength(2);
  });

  test.describe("前に名前の降順にしてあった", () => {
    test.use({ mockOptions: { fileSort: { key: "name", direction: "desc" } } });

    test("開いたときから、その並び順で表示する", async ({ main }) => {
      await main.openAuthorA();
      await expect(main.page.getByRole("button", { name: "降順。クリックで昇順" })).toBeVisible();
      await expect(main.fileNames()).toHaveText(["a5.pdf", "a4.cbz", "a3.zip", "a2.zip", "a1.zip"]);
    });
  });
});
