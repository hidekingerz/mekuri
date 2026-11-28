import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";

/** axe の違反のうち、重大度が serious 以上のもの。 */
async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.describe("アクセシビリティ（axe）", () => {
  test("ファイル一覧（選択中）・メニュー・確認ダイアログに重大な違反が無い", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    await main.file("a2.zip").click({ modifiers: ["Meta"] });
    expect(await seriousViolations(main.page)).toEqual([]);

    await main.file("a2.zip").click({ button: "right" });
    expect(await seriousViolations(main.page)).toEqual([]);

    await main.menuItem("ゴミ箱").click();
    await expect(main.dialog()).toBeVisible();
    expect(await seriousViolations(main.page)).toEqual([]);
  });

  test("フォルダツリー（展開中）とそのメニュー、お気に入りのメニューに重大な違反が無い", async ({
    main,
  }) => {
    await main.favorite("manga").click();
    await main.chevron("作者A").click();
    await expect(main.treeNode("完結")).toBeVisible();
    expect(await seriousViolations(main.page)).toEqual([]);

    await main.treeNode("完結").click({ button: "right" });
    await expect(main.menuItem("お気に入りに追加")).toBeVisible();
    expect(await seriousViolations(main.page)).toEqual([]);

    await main.favorite("mag").click({ button: "right" });
    await expect(main.menuItem("お気に入りから削除")).toBeVisible();
    expect(await seriousViolations(main.page)).toEqual([]);
  });

  test("検索結果の表示に重大な違反が無い", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("作者");
    await expect(main.matchedFolder("作者B")).toBeVisible();
    expect(await seriousViolations(main.page)).toEqual([]);
  });
});
