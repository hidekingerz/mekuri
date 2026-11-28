import { expect, test, WINDOWS_USER_AGENT } from "./helpers";

// v1.zip〜v3.zip が並ぶフォルダ。v2.zip（途中のファイル）を開く
const TREE = { "/lib": ["v1.zip", "v2.zip", "v3.zip", "sub/"], "/lib/sub": ["s1.zip"] };
const base = { tree: TREE, viewerFile: "/lib/v2.zip" };
test.use({ mockOptions: base });

test.describe("前後のファイルへの移動", () => {
  test("Alt+↓ / Alt+↑ で移動し、移動先は最初のページから開く", async ({ viewer }) => {
    await viewer.page.keyboard.press("Space");
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await expect(viewer.position()).toHaveText("1 / 6");
    await expect.poll(() => viewer.title()).toBe("v3.zip [1/6] - mekuri");

    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
  });

  test("マウスの戻る・進むボタンと、フッターの ▲▼ で移動する", async ({ viewer }) => {
    await viewer.mouseButton(3);
    await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
    await viewer.mouseButton(4);
    await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
    await viewer.button("次のファイル").click();
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await viewer.button("前のファイル").click();
    await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
  });

  test("先頭と末尾では、その向きの操作が無効になる", async ({ viewer }) => {
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await expect(viewer.button("次のファイル")).toBeDisabled();
    await expect(viewer.button("前のファイル")).toBeEnabled();
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await viewer.mouseButton(4);
    const menu = await viewer.openMenu();
    expect(menu.find((item) => item.text === "次のファイル")?.enabled).toBe(false);
    expect(menu.find((item) => item.text === "前のファイル")?.enabled).toBe(true);
    expect(await viewer.currentFile()).toBe("v3.zip");

    await viewer.page.keyboard.press("Alt+ArrowUp");
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
    await expect(viewer.button("前のファイル")).toBeDisabled();
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await viewer.mouseButton(3);
    expect(await viewer.currentFile()).toBe("v1.zip");
  });
});

test.describe("コンテキストメニュー", () => {
  test("項目がそろい、いまの表示モードにチェックが付く", async ({ viewer }) => {
    const menu = await viewer.openMenu();
    expect(menu.filter((item) => !item.separator).map((item) => item.text)).toEqual([
      "単ページ表示",
      "見開き表示",
      "3ページ表示",
      "ウィンドウ追従表示",
      "次のファイル",
      "前のファイル",
      "左→右 (LTR) に切替",
      "ゴミ箱に移動",
      "ウィンドウを閉じる",
    ]);
    expect(menu.filter((item) => item.checked).map((item) => item.text)).toEqual(["見開き表示"]);
  });

  test("表示モード・読み方向・前後のファイル・閉じる、の各項目が動く", async ({ viewer }) => {
    await viewer.openMenu();
    await viewer.chooseMenu("単ページ表示");
    await expect(viewer.position()).toHaveText("1 / 10");
    const afterMode = await viewer.openMenu();
    expect(afterMode.filter((item) => item.checked).map((item) => item.text)).toEqual([
      "単ページ表示",
    ]);

    await viewer.chooseMenu("左→右 (LTR) に切替");
    await expect(viewer.directionButton()).toHaveAttribute("aria-label", /^読み方向: 左から右/);
    const afterDirection = await viewer.openMenu();
    expect(afterDirection.map((item) => item.text)).toContain("右→左 (RTL) に切替");

    await viewer.chooseMenu("次のファイル");
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await viewer.openMenu();
    await viewer.chooseMenu("前のファイル");
    await expect.poll(() => viewer.currentFile()).toBe("v2.zip");

    await viewer.openMenu();
    await viewer.chooseMenu("ウィンドウを閉じる");
    await expect.poll(() => viewer.closed()).toBe(true);
  });
});

test.describe("ビューワーからゴミ箱へ", () => {
  test("確認のあとにだけ移し、キャンセル・Esc・開いた直後の Enter では消えない", async ({
    viewer,
  }) => {
    await viewer.page.keyboard.press("Backspace");
    await expect(viewer.dialog()).toHaveCount(0);

    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toContainText("v2.zip");
    await expect(viewer.dialog().getByRole("button", { name: "キャンセル" })).toBeFocused();
    await viewer.page.keyboard.press("Enter");
    await expect(viewer.dialog()).toHaveCount(0);

    await viewer.page.keyboard.press("Meta+Backspace");
    await expect(viewer.dialog()).toBeVisible();
    await viewer.page.keyboard.press("Escape");
    await expect(viewer.dialog()).toHaveCount(0);

    await viewer.openMenu();
    await viewer.chooseMenu("ゴミ箱に移動");
    await viewer.dialog().getByRole("button", { name: "キャンセル" }).click();
    expect(await viewer.calls("trash_file")).toEqual([]);
    expect(await viewer.folderContents("/lib")).toContain("v2.zip");
  });

  test("消したあとは次のファイル、無ければ前のファイルを開き、最後の 1 つなら閉じる", async ({
    viewer,
  }) => {
    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    expect(await viewer.calls("trash_file")).toEqual([{ path: "/lib/v2.zip" }]);
    await expect.poll(() => viewer.title()).toBe("v3.zip [1/6] - mekuri");

    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await expect.poll(() => viewer.currentFile()).toBe("v1.zip");

    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await expect.poll(() => viewer.closed()).toBe(true);
    expect(await viewer.folderContents("/lib")).toEqual(["sub/"]);
  });

  test("確認が開いているあいだは、Alt+↓ やマウスのボタンで裏のファイルが切り替わらない", async ({
    viewer,
  }) => {
    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toContainText("v2.zip");
    // 1 つずつ確かめる（下へ移って上へ戻ると、元のファイルに見えてしまう）
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await viewer.page.waitForTimeout(300);
    expect(await viewer.currentFile()).toBe("v2.zip");
    await viewer.mouseButton(3);
    await viewer.page.waitForTimeout(300);
    expect(await viewer.currentFile()).toBe("v2.zip");
    await expect(viewer.dialog()).toBeVisible();
  });

  test.describe("移動に失敗したとき", () => {
    test.use({ mockOptions: { ...base, fail: { trash_file: "Operation not permitted" } } });

    test("理由を表示し、同じファイルのまま", async ({ viewer }) => {
      await viewer.page.keyboard.press("Delete");
      await viewer.confirmTrash();
      await expect(viewer.alerts()).toContainText(
        "ゴミ箱に移動できませんでした: Operation not permitted",
      );
      expect(await viewer.currentFile()).toBe("v2.zip");
    });
  });
});

test.describe("ファイルの移動パネル", () => {
  test("サブフォルダへ移すと同じページから再開し、前後は移動先のフォルダのファイルになる", async ({
    viewer,
  }) => {
    await viewer.page.keyboard.press("Space");
    await viewer.page.keyboard.press("Space");
    await viewer.button("ファイルを移動").click();
    await viewer.page.locator(".subfolder-panel__chip", { hasText: "sub" }).click();
    await expect
      .poll(() => viewer.calls("move_file"))
      .toEqual([{ src: "/lib/v2.zip", destDir: "/lib/sub" }]);
    await expect(viewer.position()).toHaveText("3 / 6");
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect.poll(() => viewer.currentFile()).toBe("s1.zip");
  });
});

test.describe("ネストしたアーカイブ", () => {
  test.use({
    mockOptions: {
      ...base,
      nested: { "/lib/v2.zip": ["inner/第1話.zip", "inner/第2話.zip"] },
      broken: { "/lib/v2.zip!/inner/第1話.zip": "Failed to read ZIP archive: invalid Zip archive" },
    },
  });

  test("選択の画面が出て、選ぶと閲覧でき、一覧へ戻れる", async ({ viewer }) => {
    await expect(viewer.nestedItems()).toHaveText(["第1話.zip", "第2話.zip"]);
    await viewer.nestedItems().nth(1).click();
    await expect(viewer.position()).toHaveText("1 / 6");
    expect(await viewer.calls("extract_nested_archive")).toEqual([
      { parentPath: "/lib/v2.zip", nestedName: "inner/第2話.zip" },
    ]);
    await viewer.page.keyboard.press("Space");
    await expect.poll(() => viewer.title()).toBe("v2.zip [2/6] - mekuri");

    await viewer.button("アーカイブ一覧に戻る").click();
    await expect(viewer.nestedItems()).toHaveCount(2);
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
  });

  test("展開に失敗したらエラーの画面が出て、一覧へ戻って別のものを選べる", async ({ viewer }) => {
    await viewer.nestedItems().first().click();
    await expect(viewer.notice()).toContainText(
      "この ZIP ファイルは壊れているか、ZIP 形式ではありません",
    );
    await viewer.button("アーカイブ一覧に戻る").click();
    await expect(viewer.nestedItems()).toHaveCount(2);
    await viewer.nestedItems().nth(1).click();
    await expect(viewer.position()).toHaveText("1 / 6");
  });
});

test.describe("開けないファイル", () => {
  test.use({
    mockOptions: {
      ...base,
      broken: {
        "/lib/v2.zip": "Failed to read ZIP archive: invalid Zip archive: Could not find EOCD",
      },
    },
  });

  test("人向けの文と、折りたたんだ詳細が出て、前後のファイルへ移れる", async ({ viewer }) => {
    await expect(viewer.notice().locator(".viewer-notice__title")).toHaveText(
      "この ZIP ファイルは壊れているか、ZIP 形式ではありません",
    );
    const details = viewer.notice().locator("details");
    expect(await details.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await expect(details.locator(".viewer-notice__detail")).toHaveText(/Could not find EOCD/);

    await viewer.button("次のファイル").click();
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await expect(viewer.position()).toHaveText("1 / 6");
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect(viewer.notice()).toBeVisible();
    await viewer.button("前のファイル").click();
    await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
  });

  test("「閉じる」で閉じられる", async ({ viewer }) => {
    await viewer.button("閉じる").click();
    await expect.poll(() => viewer.closed()).toBe(true);
  });

  test("開けないファイルも、その画面からゴミ箱へ移せる", async ({ viewer }) => {
    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toContainText("v2.zip");
    await viewer.confirmTrash();
    await expect.poll(() => viewer.calls("trash_file")).toEqual([{ path: "/lib/v2.zip" }]);
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await expect(viewer.position()).toHaveText("1 / 6");
    await expect(viewer.dialog()).toHaveCount(0);
  });
});

test.describe("見つからないファイル", () => {
  test.use({
    mockOptions: {
      tree: TREE,
      viewerFile: "/lib/v2b.zip",
      broken: { "/lib/v2b.zip": "Failed to open archive: No such file or directory (os error 2)" },
    },
  });

  test("一覧に無いファイルでも、並び順で前後にあたるファイルへ移れる", async ({ viewer }) => {
    await expect(viewer.notice()).toContainText("ファイルが見つかりません");
    await expect(viewer.button("前のファイル")).toBeEnabled();
    await expect(viewer.button("次のファイル")).toBeEnabled();
    await viewer.button("次のファイル").click();
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
  });
});

test.describe("開いているファイルが別のウィンドウで消えたとき", () => {
  test("前後のファイルへ移れる", async ({ viewer }) => {
    await viewer.trashedElsewhere("/lib", "v2.zip");
    await expect(viewer.button("次のファイル")).toBeEnabled();
    await expect(viewer.button("前のファイル")).toBeEnabled();
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
  });
});

test.describe("画像が無いアーカイブ", () => {
  test.use({
    mockOptions: { tree: TREE, viewerFile: "/lib/v1.zip", archives: { "/lib/v1.zip": [] } },
  });

  test("その旨が出て、次のファイルへ移れる", async ({ viewer }) => {
    await expect(viewer.notice()).toContainText("このアーカイブには画像がありません");
    await expect(viewer.button("前のファイル")).toBeDisabled();
    await expect(viewer.button("閉じる")).toBeVisible();
    await viewer.button("次のファイル").click();
    await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
  });
});

test.describe("ゴミ箱の確認が開いているあいだ（メニュー）", () => {
  test("右クリックのメニューを出さない", async ({ viewer }) => {
    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toBeVisible();
    await viewer.page.evaluate(() => {
      (window as unknown as { __MOCK_MENU__: unknown }).__MOCK_MENU__ = null;
      window.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
    await viewer.page.waitForTimeout(300);
    expect(await viewer.menuShown()).toBe(false);
  });
});

test.describe("ゴミ箱への移動の失敗の表示", () => {
  test.use({ mockOptions: { ...base, fail: { trash_file: "Operation not permitted" } } });

  test("別のファイルへ移るか、次の操作が成功すると消える", async ({ viewer }) => {
    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await expect(viewer.alerts()).toHaveCount(1);
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await expect(viewer.alerts()).toHaveCount(0);

    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await expect(viewer.alerts()).toHaveCount(1);
    await viewer.stopFailing("trash_file");
    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
    await expect(viewer.alerts()).toHaveCount(0);
  });
});

test.describe("ゴミ箱への移動に時間がかかるとき", () => {
  test.use({ mockOptions: { ...base, delay: { trash_file: 500 } } });

  test("移動が終わるまでのあいだに、もう一度は消さない", async ({ viewer }) => {
    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await viewer.page.keyboard.press("Delete");
    await viewer.page.waitForTimeout(200);
    await expect(viewer.dialog()).toHaveCount(0);
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    expect(await viewer.calls("trash_file")).toEqual([{ path: "/lib/v2.zip" }]);
    await expect(viewer.alerts()).toHaveCount(0);
  });
});

test.describe("ネストの展開に時間がかかるとき", () => {
  test.use({
    mockOptions: {
      ...base,
      nested: { "/lib/v2.zip": ["inner/第1話.zip", "inner/第2話.zip"] },
      archives: {
        "/lib/v2.zip!/inner/第2話.zip": [
          ["001.jpg", 700, 1000],
          ["002.jpg", 700, 1000],
        ],
      },
      delay: { extract_nested_archive: 600 },
    },
  });

  test("展開中に別のファイルへ移っても、移動先の中身が表示され続ける", async ({ viewer }) => {
    await viewer.nestedItems().nth(1).click();
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await expect(viewer.position()).toHaveText("1 / 6");
    // 展開が終わるのを待っても、v3.zip のまま
    await viewer.page.waitForTimeout(900);
    await expect(viewer.position()).toHaveText("1 / 6");
    expect(await viewer.imageSource()).toBe("/lib/v3.zip");
    expect(await viewer.title()).toBe("v3.zip [1/6] - mekuri");
  });
});

test.describe("開けないファイルへ移ってきたとき", () => {
  test.use({
    mockOptions: {
      ...base,
      broken: {
        "/lib/v2.zip": "Failed to read ZIP archive: invalid Zip archive: Could not find EOCD",
      },
    },
  });

  test("タイトルに前のファイルのページ数を付けない", async ({ viewer }) => {
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => viewer.title()).toBe("v3.zip [1/6] - mekuri");
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect(viewer.notice()).toBeVisible();
    await viewer.page.waitForTimeout(300);
    expect(await viewer.title()).toBe("v2.zip - mekuri");
  });

  test("ページが無い画面のメニューでは、表示モードと読み方向の項目を選べない", async ({
    viewer,
  }) => {
    const menu = await viewer.openMenu();
    const modes = menu.filter((item) => /表示$/.test(item.text ?? ""));
    expect(modes).toHaveLength(4);
    expect(modes.every((item) => !item.enabled)).toBe(true);
    expect(menu.find((item) => /切替/.test(item.text ?? ""))?.enabled).toBe(false);
    // ゴミ箱・前後のファイル・閉じる、は使える
    expect(menu.find((item) => item.text === "ゴミ箱に移動")?.enabled).toBe(true);
    expect(menu.find((item) => item.text === "次のファイル")?.enabled).toBe(true);
    expect(menu.find((item) => item.text === "ウィンドウを閉じる")?.enabled).toBe(true);
  });
});

test.describe("画像が無いアーカイブ（ゴミ箱）", () => {
  test.use({
    mockOptions: { tree: TREE, viewerFile: "/lib/v1.zip", archives: { "/lib/v1.zip": [] } },
  });

  test("その画面からゴミ箱へ移せる", async ({ viewer }) => {
    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toContainText("v1.zip");
    await viewer.confirmTrash();
    await expect.poll(() => viewer.calls("trash_file")).toEqual([{ path: "/lib/v1.zip" }]);
    await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
  });
});

test.describe("ネストしたアーカイブ（選択の画面と、展開した中身）", () => {
  test.use({
    mockOptions: {
      tree: { "/lib": ["v1.zip", "v2.zip", "v3.zip", "v4.pdf"] },
      viewerFile: "/lib/v2.zip",
      nested: { "/lib/v2.zip": ["inner/第1話.zip", "inner/第2話.zip"] },
      archives: {
        "/lib/v2.zip!/inner/第1話.zip": [],
        "/lib/v3.zip": [],
      },
      broken: { "/lib/v1.zip": "Failed to read ZIP archive: invalid Zip archive" },
    },
  });

  test("選択の画面からゴミ箱へ移せる", async ({ viewer }) => {
    await expect(viewer.nestedItems()).toHaveCount(2);
    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toContainText("v2.zip");
    await viewer.confirmTrash();
    await expect.poll(() => viewer.calls("trash_file")).toEqual([{ path: "/lib/v2.zip" }]);
  });

  test("一覧へ戻ると、タイトルからページ数が消える", async ({ viewer }) => {
    await viewer.nestedItems().nth(1).click();
    await viewer.page.keyboard.press("Space");
    await expect.poll(() => viewer.title()).toBe("v2.zip [2/6] - mekuri");
    await viewer.button("アーカイブ一覧に戻る").click();
    await expect(viewer.nestedItems()).toHaveCount(2);
    await expect.poll(() => viewer.title()).toBe("v2.zip - mekuri");
  });

  test("展開した中身に画像が無いときも、一覧へ戻れる", async ({ viewer }) => {
    await viewer.nestedItems().first().click();
    await expect(viewer.notice()).toContainText("このアーカイブには画像がありません");
    await viewer.button("アーカイブ一覧に戻る").click();
    await expect(viewer.nestedItems()).toHaveCount(2);
  });

  test("開けないファイルや空のファイルへ移ったあとは、「一覧に戻る」を出さない", async ({
    viewer,
  }) => {
    await expect(viewer.nestedItems()).toHaveCount(2);
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect(viewer.notice()).toContainText("壊れている");
    await expect(viewer.button("アーカイブ一覧に戻る")).toHaveCount(0);
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect(viewer.nestedItems()).toHaveCount(2);
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect(viewer.notice()).toContainText("このアーカイブには画像がありません");
    await expect(viewer.button("アーカイブ一覧に戻る")).toHaveCount(0);
  });
});

test.describe("ネストを読んでいる途中で PDF へ移って戻るとき", () => {
  test.use({
    mockOptions: {
      tree: { "/lib": ["v2.zip", "v4.pdf"] },
      viewerFile: "/lib/v2.zip",
      nested: { "/lib/v2.zip": ["inner/第1話.zip", "inner/第2話.zip"] },
    },
  });

  test("選択の画面のタイトルに、前に読んでいたページ数を付けない", async ({ viewer }) => {
    await viewer.nestedItems().nth(1).click();
    await viewer.page.keyboard.press("Space");
    await expect.poll(() => viewer.title()).toBe("v2.zip [2/6] - mekuri");
    // モックでは PDF は開けないファイルとして表示される
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect(viewer.notice()).toBeVisible();
    await expect.poll(() => viewer.title()).toBe("v4.pdf - mekuri");
    const imagesBefore = (await viewer.calls("get_archive_image")).length;
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect(viewer.nestedItems()).toHaveCount(2);
    await viewer.page.waitForTimeout(300);
    expect(await viewer.title()).toBe("v2.zip - mekuri");
    // 前に読んでいたページを、一瞬でも描き直そうとしない
    expect((await viewer.calls("get_archive_image")).length).toBe(imagesBefore);
  });
});

test.describe("ネストの展開中に別のファイルへ移って、すぐ戻るとき", () => {
  test.use({
    mockOptions: {
      ...base,
      nested: { "/lib/v2.zip": ["inner/第1話.zip", "inner/第2話.zip"] },
      delay: { extract_nested_archive: 1000 },
    },
  });

  test("選んでいないのに、前の展開の中身が開くことはない", async ({ viewer }) => {
    await viewer.nestedItems().nth(1).click();
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect(viewer.nestedItems()).toHaveCount(2);
    // 前の展開が終わるのを待っても、選択の画面のまま
    await viewer.page.waitForTimeout(1300);
    await expect(viewer.nestedItems()).toHaveCount(2);
    expect(await viewer.title()).toBe("v2.zip - mekuri");
  });
});

test.describe("一覧の取得に時間がかかるとき", () => {
  test.use({ mockOptions: { ...base, delay: { read_directory: 400 } } });

  test("Alt+↓ の直後に確認を出したら、確認の裏でファイルを切り替えない", async ({ viewer }) => {
    await viewer.page.keyboard.press("Alt+ArrowDown");
    await viewer.page.keyboard.press("Delete");
    await expect(viewer.dialog()).toContainText("v2.zip");
    await viewer.page.waitForTimeout(900);
    await expect(viewer.dialog()).toContainText("v2.zip");
    expect(await viewer.currentFile()).toBe("v2.zip");
  });
});

test.describe("ゴミ箱への移動の途中で、別のファイルへ移ったとき", () => {
  test.use({ mockOptions: { ...base, delay: { trash_file: 700 } } });

  test("移動が終わっても、移った先のファイルを開いたままにする", async ({ viewer }) => {
    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await viewer.page.keyboard.press("Alt+ArrowUp");
    await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
    await expect.poll(() => viewer.folderContents("/lib")).not.toContain("v2.zip");
    await viewer.page.waitForTimeout(300);
    expect(await viewer.currentFile()).toBe("v1.zip");
    expect(await viewer.title()).toBe("v1.zip [1/6] - mekuri");
  });
});

test.describe("モックの失敗の設定", () => {
  test("あとから足した失敗も効く", async ({ viewer }) => {
    await viewer.page.evaluate(() => {
      (
        window as unknown as { __MOCK_OPTS__: { fail?: Record<string, string> } }
      ).__MOCK_OPTS__.fail = { trash_file: "Operation not permitted" };
    });
    await viewer.page.keyboard.press("Delete");
    await viewer.confirmTrash();
    await expect(viewer.alerts()).toHaveCount(1);
  });
});

test.describe("メインウィンドウの一覧の並び順に合わせた移動", () => {
  // 名前の順は v1, v2, v3。更新日時の新しい順は v1, v3, v2
  const fileMeta = {
    "/lib/v1.zip": { modified_ms: 300 },
    "/lib/v2.zip": { modified_ms: 100 },
    "/lib/v3.zip": { modified_ms: 200 },
  };
  const newestFirst = { key: "modified", direction: "desc" } as const;

  test.describe("更新日時の新しい順にしてある", () => {
    test.use({ mockOptions: { ...base, fileMeta, fileSort: newestFirst } });

    test("一覧で下にあるファイルが次、上にあるファイルが前になる", async ({ viewer }) => {
      // v2.zip は一番古いので、一覧の末尾
      await expect(viewer.button("次のファイル")).toBeDisabled();
      await viewer.page.keyboard.press("Alt+ArrowDown");
      expect(await viewer.currentFile()).toBe("v2.zip");

      await viewer.page.keyboard.press("Alt+ArrowUp");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
      await viewer.button("前のファイル").click();
      await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
      await expect(viewer.button("前のファイル")).toBeDisabled();
      const menu = await viewer.openMenu();
      expect(menu.find((item) => item.text === "前のファイル")?.enabled).toBe(false);
      expect(menu.find((item) => item.text === "次のファイル")?.enabled).toBe(true);

      await viewer.mouseButton(4);
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    });

    test("ゴミ箱へ移したあとは、一覧での次のファイル（無ければ前）を開く", async ({ viewer }) => {
      await viewer.page.keyboard.press("Alt+ArrowUp");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
      // v3.zip の次は v2.zip（名前の順なら、次は無く、前の v2.zip）
      await viewer.page.keyboard.press("Delete");
      await viewer.confirmTrash();
      await expect.poll(() => viewer.currentFile()).toBe("v2.zip");

      // v2.zip は末尾なので、前の v1.zip へ
      await viewer.page.keyboard.press("Delete");
      await viewer.confirmTrash();
      await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
    });

    test("別のウィンドウで消されたファイルからは、消える前の位置の前後へ移れる", async ({
      viewer,
    }) => {
      await viewer.page.keyboard.press("Alt+ArrowUp");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
      // 一覧は v1, v3, v2 の順。前の v1.zip と、開いている v3.zip が消される
      await viewer.trashedElsewhere("/lib", "v1.zip");
      await viewer.trashedElsewhere("/lib", "v3.zip");
      // v3.zip は v2.zip より上にあったので、前は無く、次が v2.zip（末尾として扱うと逆になる）
      await expect(viewer.button("前のファイル")).toBeDisabled();
      await expect(viewer.button("次のファイル")).toBeEnabled();
      await viewer.page.keyboard.press("Alt+ArrowUp");
      await viewer.page.keyboard.press("Alt+ArrowDown");
      await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
    });
  });

  test.describe("サイズの大きい順にしてある", () => {
    test.use({
      mockOptions: {
        ...base,
        fileMeta: {
          "/lib/v1.zip": { size: 10 },
          "/lib/v2.zip": { size: 30 },
          "/lib/v3.zip": { size: 20 },
        },
        fileSort: { key: "size", direction: "desc" },
      },
    });

    test("大きいファイルから小さいファイルへ進む", async ({ viewer }) => {
      await expect(viewer.button("前のファイル")).toBeDisabled();
      await viewer.page.keyboard.press("Alt+ArrowDown");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
      await viewer.page.keyboard.press("Alt+ArrowDown");
      await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
      await expect(viewer.button("次のファイル")).toBeDisabled();
    });
  });

  test.describe("名前の降順にしてある", () => {
    test.use({ mockOptions: { ...base, fileSort: { key: "name", direction: "desc" } } });

    test("名前の大きいほうから小さいほうへ進む", async ({ viewer }) => {
      await viewer.page.keyboard.press("Alt+ArrowDown");
      await expect.poll(() => viewer.currentFile()).toBe("v1.zip");
      await expect(viewer.button("次のファイル")).toBeDisabled();
    });
  });

  test.describe("開いているあいだに並び順が変わる", () => {
    test.use({ mockOptions: { ...base, fileMeta } });

    test("前後のボタンの有効・無効と、移動の順が、新しい並び順に変わる", async ({ viewer }) => {
      // 名前の順では、v2.zip は真ん中
      await expect(viewer.button("次のファイル")).toBeEnabled();
      await viewer.sortChangedElsewhere(newestFirst);
      await expect(viewer.button("次のファイル")).toBeDisabled();
      await expect(viewer.button("前のファイル")).toBeEnabled();
      await viewer.page.keyboard.press("Alt+ArrowUp");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
    });
  });

  test.describe("保存されている並び順が、いまの版の知らない値", () => {
    test.use({
      mockOptions: {
        ...base,
        fileMeta,
        // 向きが知らない値。そのまま使うと、更新日時の降順として並んでしまう
        fileSort: { key: "modified", direction: "down" } as never,
      },
    });

    test("名前の昇順で移動する", async ({ viewer }) => {
      await expect(viewer.button("次のファイル")).toBeEnabled();
      await viewer.page.keyboard.press("Alt+ArrowDown");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
      await expect(viewer.button("次のファイル")).toBeDisabled();
    });
  });
});

test.describe("中のアーカイブが 1 つだけのアーカイブ", () => {
  test.describe("開ける", () => {
    test.use({ mockOptions: { ...base, nested: { "/lib/v2.zip": ["inner/第1話.zip"] } } });

    test("選択の画面を出さずに、中のアーカイブをそのまま開く", async ({ viewer }) => {
      await expect(viewer.position()).toHaveText("1 / 6");
      await expect(viewer.nestedItems()).toHaveCount(0);
      expect(await viewer.calls("extract_nested_archive")).toEqual([
        { parentPath: "/lib/v2.zip", nestedName: "inner/第1話.zip" },
      ]);
      expect(await viewer.imageSource()).toBe("/lib/v2.zip!/inner/第1話.zip");
      // 戻る先の一覧が無いので、戻るボタンも出さない
      await expect(viewer.button("アーカイブ一覧に戻る")).toHaveCount(0);
      await expect.poll(() => viewer.title()).toBe("v2.zip [1/6] - mekuri");
    });

    test("前後のファイルへ移れて、戻ってきてもそのまま開く", async ({ viewer }) => {
      await viewer.page.keyboard.press("Alt+ArrowDown");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
      await viewer.page.keyboard.press("Alt+ArrowUp");
      await expect.poll(() => viewer.currentFile()).toBe("v2.zip");
      await expect(viewer.position()).toHaveText("1 / 6");
      await expect(viewer.nestedItems()).toHaveCount(0);
    });

    test("ゴミ箱へ移すのは、外側のファイル", async ({ viewer }) => {
      await viewer.page.keyboard.press("Delete");
      await expect(viewer.dialog()).toContainText("v2.zip");
      await viewer.confirmTrash();
      await expect.poll(() => viewer.calls("trash_file")).toEqual([{ path: "/lib/v2.zip" }]);
    });
  });

  test.describe("展開に失敗する", () => {
    test.use({
      expectedConsoleError: null,
      mockOptions: {
        ...base,
        nested: { "/lib/v2.zip": ["inner/第1話.zip"] },
        broken: {
          "/lib/v2.zip!/inner/第1話.zip": "Failed to read ZIP archive: invalid Zip archive",
        },
      },
    });

    test("エラーの画面が出て、戻るボタンは出ず、前後のファイルへは移れる", async ({ viewer }) => {
      await expect(viewer.notice()).toContainText(
        "この ZIP ファイルは壊れているか、ZIP 形式ではありません",
      );
      await expect(viewer.button("アーカイブ一覧に戻る")).toHaveCount(0);
      await viewer.page.keyboard.press("Alt+ArrowDown");
      await expect.poll(() => viewer.currentFile()).toBe("v3.zip");
      await expect(viewer.position()).toHaveText("1 / 6");
    });
  });

  test.describe("中のアーカイブに画像が無い", () => {
    test.use({
      mockOptions: {
        ...base,
        nested: { "/lib/v2.zip": ["inner/第1話.zip"] },
        archives: { "/lib/v2.zip!/inner/第1話.zip": [] },
      },
    });

    test("画像が無いことを知らせ、戻るボタンは出さない", async ({ viewer }) => {
      await expect(viewer.notice()).toContainText("このアーカイブには画像がありません");
      await expect(viewer.button("アーカイブ一覧に戻る")).toHaveCount(0);
    });
  });
});

test.describe("ゴミ箱のショートカットは OS に合わせる", () => {
  test("macOS では Ctrl+Backspace を受け付けない", async ({ viewer }) => {
    await viewer.page.keyboard.press("Control+Backspace");
    await expect(viewer.dialog()).toHaveCount(0);
    await viewer.page.keyboard.press("Meta+Backspace");
    await expect(viewer.dialog()).toBeVisible();
  });

  test.describe("Windows", () => {
    test.use({ userAgent: WINDOWS_USER_AGENT });

    test("Delete だけを受け付け、Backspace は修飾キーつきでも受け付けない", async ({ viewer }) => {
      await viewer.page.keyboard.press("Control+Backspace");
      await viewer.page.keyboard.press("Meta+Backspace");
      await expect(viewer.dialog()).toHaveCount(0);
      await viewer.page.keyboard.press("Delete");
      await expect(viewer.dialog()).toBeVisible();
    });
  });
});
