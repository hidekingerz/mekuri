import { expect, test } from "./helpers";

test.describe("お気に入りの登録と削除", () => {
  test.describe("フォルダ選択ダイアログ", () => {
    test.use({ mockOptions: { dialog: "/m/manga/作者A" } });

    test("選んだフォルダを登録し、そのお気に入りを開く", async ({ main }) => {
      await main.toolbarButton("フォルダを追加").click();
      await expect(main.favorite("作者A")).toBeVisible();
      expect(await main.favorites()).toEqual(["/m/manga", "/m/mag", "/m/manga/作者A"]);
      await expect(main.favorite("作者A")).toHaveAttribute("aria-current", "true");
      expect(await main.treeNames()).toEqual(["完結", "連載中"]);
      await expect(main.file("a1.zip")).toBeVisible();
    });

    test("登録済みのフォルダは増やさず、そのお気に入りを開く", async ({ main }) => {
      await main.toolbarButton("フォルダを追加").click();
      await main.favorite("manga").click();
      await main.toolbarButton("フォルダを追加").click();
      await expect(main.favorite("作者A")).toHaveAttribute("aria-current", "true");
      expect(await main.favorites()).toEqual(["/m/manga", "/m/mag", "/m/manga/作者A"]);
    });
  });

  test("ダイアログをキャンセルしたら、何も変わらない", async ({ main }) => {
    await main.favorite("manga").click();
    await main.toolbarButton("フォルダを追加").click();
    await expect(main.favorite("manga")).toHaveAttribute("aria-current", "true");
    expect(await main.favorites()).toEqual(["/m/manga", "/m/mag"]);
  });

  test("ツリーのメニューから登録でき、2 回目は増えない", async ({ main }) => {
    await main.favorite("manga").click();
    for (let i = 0; i < 2; i++) {
      await main.treeNode("作者A").click({ button: "right" });
      await main.menuItem("お気に入りに追加").click();
      await expect(main.favorite("作者A")).toBeVisible();
    }
    expect(await main.favorites()).toEqual(["/m/manga", "/m/mag", "/m/manga/作者A"]);
    // 開いているお気に入りは変わらない
    await expect(main.favorite("manga")).toHaveAttribute("aria-current", "true");
  });

  test("選んでいないお気に入りを外しても、表示中のお気に入りはそのまま", async ({ main }) => {
    await main.favorite("manga").click();
    await main.favorite("mag").click({ button: "right" });
    await main.menuItem("お気に入りから削除").click();
    await expect(main.favorite("mag")).toHaveCount(0);
    expect(await main.favorites()).toEqual(["/m/manga"]);
    expect(await main.treeNames()).toEqual(["作者A", "作者B", "空フォルダ"]);
  });

  test("表示中のお気に入りを外すと、ツリー・一覧・検索・タイトルも閉じる", async ({ main }) => {
    await main.openAuthorA();
    await main.favorite("manga").click({ button: "right" });
    await main.menuItem("お気に入りから削除").click();
    await expect(main.favorite("manga")).toHaveCount(0);
    await expect(main.page.locator('[aria-label="フォルダツリー"]')).toHaveCount(0);
    await expect(main.file("a1.zip")).toHaveCount(0);
    await expect(main.searchBox()).toBeDisabled();
    await expect(main.toolbarButton("再読み込み")).toBeDisabled();
    await expect
      .poll(async () => (await main.calls("plugin:window|set_title")).at(-1)?.value)
      .toBe("mekuri");
  });

  test.describe("保存に失敗する", () => {
    test.use({ mockOptions: { dialog: "/m/manga/作者A" }, expectedConsoleError: /disk full/ });

    test("ダイアログからの登録の失敗を知らせる", async ({ main }) => {
      await main.setMock("fail", "plugin:store|set", "disk full");
      await main.toolbarButton("フォルダを追加").click();
      await expect(main.alerts()).toContainText("お気に入りを保存できませんでした: disk full");
      await expect(main.favorite("作者A")).toHaveCount(0);
    });

    test("ツリーのメニューからの登録の失敗を知らせる", async ({ main }) => {
      await main.favorite("manga").click();
      await main.setMock("fail", "plugin:store|set", "disk full");
      await main.treeNode("作者A").click({ button: "right" });
      await main.menuItem("お気に入りに追加").click();
      await expect(main.alerts()).toContainText("お気に入りを保存できませんでした: disk full");
      // 失敗が解けたあとにやり直せて、前の失敗の表示は消える
      await main.setMock("fail", "plugin:store|set", null);
      await main.treeNode("作者A").click({ button: "right" });
      await main.menuItem("お気に入りに追加").click();
      await expect(main.favorite("作者A")).toBeVisible();
      await expect(main.alerts()).toHaveCount(0);
    });

    test("外すときの失敗を知らせ、一覧には残す", async ({ main }) => {
      await main.favorite("manga").click();
      await main.setMock("fail", "plugin:store|set", "disk full");
      await main.favorite("mag").click({ button: "right" });
      await main.menuItem("お気に入りから削除").click();
      await expect(main.alerts()).toContainText("お気に入りを保存できませんでした: disk full");
      await expect(main.favorite("mag")).toBeVisible();
    });
  });
});

test.describe("フォルダツリー", () => {
  test("シェブロン・ダブルクリック・← → で開閉し、サブフォルダの無いフォルダにはシェブロンが無い", async ({
    main,
  }) => {
    await main.favorite("manga").click();
    expect(await main.treeNames()).toEqual(["作者A", "作者B", "空フォルダ"]);
    await expect(main.chevron("作者A")).toHaveCount(1);
    await expect(main.chevron("作者B")).toHaveCount(0);
    await expect(main.chevron("空フォルダ")).toHaveCount(0);
    await expect(main.treeNode("作者A")).toHaveAttribute("aria-expanded", "false");

    await main.chevron("作者A").click();
    expect(await main.treeNames()).toEqual(["作者A", "完結", "連載中", "作者B", "空フォルダ"]);
    await expect(main.treeNode("作者A")).toHaveAttribute("aria-expanded", "true");
    await main.chevron("作者A").click();
    expect(await main.treeNames()).toEqual(["作者A", "作者B", "空フォルダ"]);

    await main.treeNode("作者A").dblclick();
    await expect(main.treeNode("完結")).toBeVisible();
    await main.treeNode("作者A").focus();
    await main.page.keyboard.press("ArrowLeft");
    await expect(main.treeNode("完結")).toHaveCount(0);
    await main.page.keyboard.press("ArrowRight");
    await expect(main.treeNode("完結")).toBeVisible();
  });

  test("Enter でフォルダを選び、↑ ↓ Home End で項目を移る", async ({ main }) => {
    await main.favorite("manga").click();
    await main.treeNode("作者A").focus();
    await main.page.keyboard.press("ArrowDown");
    await expect(main.treeNode("作者B")).toBeFocused();
    await main.page.keyboard.press("Enter");
    await expect(main.file("b1.zip")).toBeVisible();
    expect(await main.selectedTreeNodes().allTextContents()).toEqual(["作者B"]);
    await main.page.keyboard.press("End");
    await expect(main.treeNode("空フォルダ")).toBeFocused();
    await main.page.keyboard.press("Home");
    await expect(main.treeNode("作者A")).toBeFocused();
    await main.page.keyboard.press("ArrowUp");
    await expect(main.treeNode("作者A")).toBeFocused();
  });

  test("サブフォルダの無いフォルダは、→ やダブルクリックでも開いた表示にならず、読み込みもしない", async ({
    main,
  }) => {
    await main.favorite("manga").click();
    const before = (await main.calls("read_directory")).length;
    const icon = await main.treeNode("作者B").locator(".tree-node__icon").innerHTML();
    await main.treeNode("作者B").focus();
    await main.page.keyboard.press("ArrowRight");
    await main.treeNode("作者B").dblclick();
    // ダブルクリックの 1 回目のクリックで選ばれるので、一覧の読み込みは 1 回ある
    await expect(main.file("b1.zip")).toBeVisible();
    expect(await main.treeNode("作者B").locator(".tree-node__icon").innerHTML()).toBe(icon);
    const reads = (await main.calls("read_directory")).slice(before).map((c) => c.path);
    expect(reads).toEqual(["/m/manga/作者B"]);
  });

  test("読み込むのは、選んだお気に入りの直下と、展開したフォルダの直下だけ", async ({ main }) => {
    await main.favorite("manga").click();
    await expect(main.treeNode("作者A")).toBeVisible();
    // ツリーと一覧が、それぞれお気に入りの直下を読む
    expect((await main.calls("read_directory")).map((c) => c.path)).toEqual([
      "/m/manga",
      "/m/manga",
    ]);
    await main.chevron("作者A").click();
    await expect(main.treeNode("完結")).toBeVisible();
    await main.chevron("作者A").click();
    await main.chevron("作者A").click();
    await expect(main.treeNode("完結")).toBeVisible();
    // 開き直しでは読み直さない
    expect((await main.calls("read_directory")).map((c) => c.path)).toEqual([
      "/m/manga",
      "/m/manga",
      "/m/manga/作者A",
    ]);
  });

  test.describe("隠しフォルダだけを持つフォルダ", () => {
    test.use({
      mockOptions: {
        tree: { "/r": ["H/", ".git/"], "/r/H": [".cache/"], "/r/H/.cache": [], "/r/.git": [] },
        favorites: ["/r"],
      },
    });

    test("隠しフォルダは出さず、シェブロンも出さない", async ({ main }) => {
      await main.favorite("r").click();
      expect(await main.treeNames()).toEqual(["H"]);
      await expect(main.chevron("H")).toHaveCount(0);
    });
  });

  test.describe("読み込みが遅い", () => {
    const tree = {
      "/r": ["X/", "Y/"],
      "/r/X": ["x1/"],
      "/r/X/x1": [],
      "/r/Y": ["y1/"],
      "/r/Y/y1": [],
      "/s": ["S1/"],
      "/s/S1": [],
    };
    test.use({ mockOptions: { tree, favorites: ["/r", "/s"] } });

    test("読み込みの途中でお気に入りを切り替えると、あとに選んだほうのツリーが出る", async ({
      main,
    }) => {
      await main.setMock("delay", "read_directory", 400);
      await main.favorite("r").click();
      await main.favorite("s").click();
      await expect(main.treeNode("S1")).toBeVisible();
      await main.page.waitForTimeout(600);
      expect(await main.treeNames()).toEqual(["S1"]);
    });

    test("お気に入りを切り替えたら、読み込みが終わるまで前のお気に入りのツリーを出さない", async ({
      main,
    }) => {
      await main.favorite("r").click();
      await main.chevron("X").click();
      await expect(main.treeNode("x1")).toBeVisible();
      await main.setMock("delay", "read_directory", 400);
      await main.favorite("s").click();
      await expect(main.page.locator(".folder-tree-loading")).toHaveText("読み込み中...");
      expect(await main.treeNames()).toEqual([]);
      await expect(main.treeNode("S1")).toBeVisible();
    });

    test("遅い展開の途中で別のフォルダを展開しても、両方が開く", async ({ main }) => {
      await main.favorite("r").click();
      await expect(main.treeNode("X")).toBeVisible();
      await main.setMock("delay", "read_directory", 500);
      await main.chevron("X").click();
      await main.setMock("delay", "read_directory", null);
      await main.chevron("Y").click();
      await expect(main.treeNode("y1")).toBeVisible();
      await expect(main.treeNode("x1")).toBeVisible();
      expect(await main.treeNames()).toEqual(["X", "x1", "Y", "y1"]);
    });

    test("展開の途中でお気に入りを切り替えても、前のお気に入りのツリーは出ない", async ({
      main,
    }) => {
      await main.favorite("r").click();
      await expect(main.treeNode("X")).toBeVisible();
      await main.setMock("delay", "read_directory", 500);
      await main.chevron("X").click();
      await main.setMock("delay", "read_directory", null);
      await main.favorite("s").click();
      await expect(main.treeNode("S1")).toBeVisible();
      await main.page.waitForTimeout(700);
      expect(await main.treeNames()).toEqual(["S1"]);
    });

    test("展開の途中で再読み込みしても、増えたフォルダが消えない", async ({ main }) => {
      await main.favorite("r").click();
      await expect(main.treeNode("X")).toBeVisible();
      await main.addFolder("/r", ["X/", "Y/", "Z/"]);
      await main.addFolder("/r/Z", []);
      await main.setMock("delay", "read_directory", 500);
      await main.chevron("X").click();
      await main.setMock("delay", "read_directory", null);
      await main.toolbarButton("再読み込み").click();
      await expect(main.treeNode("Z")).toBeVisible();
      await expect(main.treeNode("x1")).toBeVisible();
      expect(await main.treeNames()).toEqual(["X", "x1", "Y", "Z"]);
    });
  });

  test.describe("読み込みに失敗する", () => {
    test.use({
      mockOptions: { favorites: ["/m/later", "/m/manga"] },
      expectedConsoleError: /Failed to read directory|Failed to load/,
    });

    test("お気に入りを読めないときは理由を出し、読めるようになったら再読み込みで戻る", async ({
      main,
    }) => {
      await main.favorite("later").click();
      await expect(main.page.locator(".folder-tree-error")).toContainText(
        "フォルダを読み込めませんでした",
      );
      await expect(main.page.locator(".file-list__message--error")).toContainText(
        "読み込めませんでした",
      );
      // 読み込みを繰り返さない（ツリーと一覧で 1 回ずつ）
      await main.page.waitForTimeout(500);
      expect((await main.calls("read_directory")).length).toBe(2);

      await main.addFolder("/m/later", ["sub/", "n1.zip"]);
      await main.addFolder("/m/later/sub", []);
      await main.toolbarButton("再読み込み").click();
      await expect(main.treeNode("sub")).toBeVisible();
      await expect(main.file("n1.zip")).toBeVisible();
    });

    test("展開に失敗したフォルダは開いた表示にせず、あとで開き直せる", async ({ main }) => {
      await main.favorite("manga").click();
      await main.setMock("fail", "read_directory", "Failed to read directory: denied");
      await main.chevron("作者A").click();
      await expect(main.treeNode("作者A")).toHaveAttribute("aria-expanded", "false");
      await main.setMock("fail", "read_directory", null);
      await main.chevron("作者A").click();
      await expect(main.treeNode("完結")).toBeVisible();
    });
  });

  test("再読み込みで、外で増えた・消えたサブフォルダとシェブロンが合う", async ({ main }) => {
    await main.favorite("manga").click();
    await main.treeNode("空フォルダ").click();
    await main.addFolder("/m/manga/空フォルダ", ["新/"]);
    await main.addFolder("/m/manga/空フォルダ/新", []);
    await main.toolbarButton("再読み込み").click();
    await expect(main.chevron("空フォルダ")).toHaveCount(1);

    await main.chevron("作者A").click();
    await main.treeNode("作者A").click();
    await expect(main.treeNode("完結")).toBeVisible();
    await main.addFolder("/m/manga/作者A", ["a1.zip"]);
    await main.toolbarButton("再読み込み").click();
    await expect(main.treeNode("完結")).toHaveCount(0);
    await expect(main.chevron("作者A")).toHaveCount(0);
  });

  test("メニューは 1 つだけ開く", async ({ main }) => {
    await main.openAuthorA();
    await main.favorite("mag").click({ button: "right" });
    await main.treeNode("作者B").click({ button: "right" });
    await expect(main.page.locator(".context-menu")).toHaveCount(1);
    await expect(main.menuItem("お気に入りに追加")).toBeVisible();
    await main.file("a1.zip").click({ button: "right" });
    await expect(main.page.locator(".context-menu")).toHaveCount(1);
    await expect(main.menuItem("お気に入りに追加")).toHaveCount(0);
  });
});

test.describe("ファイル一覧の表示", () => {
  test("アーカイブと PDF だけを出し、件数を見出しに出す", async ({ main }) => {
    await main.openAuthorA();
    await expect(main.fileNames()).toHaveText(["a1.zip", "a2.zip", "a3.zip", "a4.cbz", "a5.pdf"]);
    await expect(main.page.locator(".file-list__count")).toHaveText("5 件");
    await expect(main.page.getByLabel("並び順")).toBeVisible();
    // PDF は別のアイコン
    const icon = (name: string) => main.file(name).locator("svg").first().innerHTML();
    expect(await icon("a1.zip")).toBe(await icon("a4.cbz"));
    expect(await icon("a5.pdf")).not.toBe(await icon("a1.zip"));

    await main.treeNode("空フォルダ").click();
    await expect(main.page.locator(".file-list__message")).toHaveText(
      "このフォルダにアーカイブや PDF はありません",
    );
    await main.favorite("mag").click();
    await expect(main.page.locator(".file-list__count")).toHaveText("1 件");
    // 1 件のときは並べ替えの欄を出さない
    await expect(main.page.getByLabel("並び順")).toHaveCount(0);
  });

  test.describe("名前の並び", () => {
    test.use({
      mockOptions: {
        tree: { "/r": ["v10.zip", "V2.zip", "b/", "v1.zip", "A10/", "a2/", "v02.pdf"] },
        favorites: ["/r"],
      },
    });

    test("フォルダもファイルも、数字は数値として、大文字と小文字は区別せずに並ぶ", async ({
      main,
    }) => {
      await main.favorite("r").click();
      expect(await main.treeNames()).toEqual(["a2", "A10", "b"]);
      await expect(main.fileNames()).toHaveText(["v1.zip", "v02.pdf", "V2.zip", "v10.zip"]);
    });
  });

  test("フォルダの切り替えが速いとき、あとに選んだフォルダの中身が出る", async ({ main }) => {
    await main.favorite("manga").click();
    await expect(main.treeNode("作者A")).toBeVisible();
    await main.setMock("delay", "read_directory", 400);
    await main.treeNode("作者A").click();
    await main.setMock("delay", "read_directory", null);
    await main.treeNode("作者B").click();
    await expect(main.fileNames()).toHaveText(["b1.zip", "b2.zip"]);
    await main.page.waitForTimeout(600);
    await expect(main.fileNames()).toHaveText(["b1.zip", "b2.zip"]);
  });

  test.describe("ファイルの多いフォルダ", () => {
    const names = Array.from({ length: 80 }, (_, i) => `f${String(i + 1).padStart(2, "0")}.zip`);
    test.use({
      mockOptions: { tree: { "/r": names }, favorites: ["/r"], delay: { read_directory: 30 } },
    });

    test("別のウィンドウでファイルが消えても、スクロールの位置とフォーカスを保つ", async ({
      main,
    }) => {
      await main.favorite("r").click();
      await main.file("f70.zip").click();
      const items = main.page.locator(".file-list__items");
      const before = await items.evaluate((el) => el.scrollTop);
      expect(before).toBeGreaterThan(0);
      await main.trashedElsewhere("/r", "f01.zip");
      await expect(main.file("f01.zip")).toHaveCount(0);
      await expect(main.file("f70.zip")).toBeFocused();
      expect(await items.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await main.selectedFiles()).toEqual(["f70.zip"]);
    });

    test("Delete でゴミ箱へ移したあと、そのまま ↑ ↓ で続けられる", async ({ main }) => {
      await main.favorite("r").click();
      await main.file("f70.zip").click();
      await main.page.keyboard.press("Delete");
      await main.confirmTrash();
      await expect(main.file("f70.zip")).toHaveCount(0);
      // 消した項目のあった位置（次の f71.zip）にフォーカスが移り、そこから続けられる
      await expect(main.file("f71.zip")).toBeFocused();
      await main.page.keyboard.press("ArrowDown");
      await expect.poll(() => main.selectedFiles()).toEqual(["f72.zip"]);
      expect(
        await main.page.locator(".file-list__items").evaluate((el) => el.scrollTop),
      ).toBeGreaterThan(0);
    });
  });
});

test.describe("ファイルを開く", () => {
  test("クリックは選ぶだけで、ダブルクリックでビューワーを開く。PDF も同じ", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").click();
    expect(await main.openedViewers()).toEqual([]);
    await main.file("a1.zip").dblclick();
    await main.file("a5.pdf").dblclick();
    await expect
      .poll(async () => (await main.openedViewers()).map((v) => v.name))
      .toEqual(["a1.zip", "a5.pdf"]);
  });

  test("すでに開いているファイルは、新しく開かずにそのウィンドウを前に出す", async ({ main }) => {
    await main.openAuthorA();
    await main.file("a1.zip").dblclick();
    await expect.poll(async () => (await main.openedViewers()).length).toBe(1);
    await main.file("a1.zip").dblclick();
    await expect.poll(async () => (await main.calls("plugin:window|set_focus")).length).toBe(1);
    expect((await main.openedViewers()).map((v) => v.name)).toEqual(["a1.zip"]);

    // 別のフォルダの同じ名前のファイルは、別のウィンドウ
    await main.chevron("作者A").click();
    await main.treeNode("連載中").click();
    await main.file("a1.zip").dblclick();
    await expect.poll(async () => (await main.openedViewers()).length).toBe(2);
  });
});

test.describe("カラム幅", () => {
  test("境界をドラッグして変えられ、どちらの列も最小幅より狭くならず、離すと保存する", async ({
    main,
  }) => {
    await main.favorite("manga").click();
    const tree = main.page.locator(".app__tree-column");
    const files = main.page.locator(".app__file-column");
    const handle = main.page.locator(".app__resize-handle");
    const width = async (column: typeof tree) => (await column.boundingBox())?.width;
    const dragTo = async (x: number) => {
      const box = await handle.boundingBox();
      if (!box) throw new Error("resize handle is not visible");
      await main.page.mouse.move(box.x + 2, box.y + 100);
      await main.page.mouse.down();
      await main.page.mouse.move(x, box.y + 100, { steps: 4 });
      await main.page.mouse.up();
    };
    const saved = () =>
      main.page.evaluate(
        () =>
          (
            window as unknown as {
              __MOCK_STORE__: { windowSettings?: { treeColumnWidth: number } };
            }
          ).__MOCK_STORE__.windowSettings?.treeColumnWidth,
      );

    expect(await width(tree)).toBe(300);
    await dragTo(600);
    expect(await width(tree)).toBe(420);
    await expect.poll(saved).toBe(420);
    await dragTo(0);
    expect(await width(tree)).toBe(150);
    await dragTo(5000);
    expect(await width(files)).toBe(150);
    await expect.poll(saved).toBe(await width(tree));
  });
});

test.describe("検索", () => {
  test("フォルダとファイルを名前で探し、大文字と小文字は区別しない", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("A1");
    await expect(main.fileNames()).toHaveText(["a1.zip", "a1.zip"]);
    await expect(main.page.locator(".file-list__count")).toHaveText("2 件");
    await expect(main.page.locator(".folder-tree__search-count")).toHaveText("0 件");

    await main.searchBox().fill("シリーズ");
    await expect(main.matchedFolder("シリーズX")).toContainText("作者A/完結");
    await expect(main.resultFolder("シリーズX")).toBeVisible();
    await expect(main.page.locator(".file-list__count")).toHaveText("1 件");

    await main.searchBox().fill("どこにも無い名前");
    await expect(main.page.locator(".file-list__message")).toHaveText("一致するものがありません");
  });

  test("別のフォルダにある同じ名前のファイルは、場所で見分けられる", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("a1");
    await expect(main.fileAt("/m/manga/作者A/a1.zip")).toContainText("作者A");
    await expect(main.fileAt("/m/manga/作者A/連載中/a1.zip")).toContainText("作者A/連載中");
  });

  test("隠しファイルと、アーカイブでも PDF でもないファイルは出さない", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("メモ");
    await expect(main.page.locator(".file-list__message")).toHaveText("一致するものがありません");
    await main.searchBox().fill("DS_");
    await expect(main.page.locator(".file-list__message")).toHaveText("一致するものがありません");
  });

  test("検索語の前後の空白は無視し、空白だけでは検索しない", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("  作者B ");
    await expect(main.matchedFolder("作者B")).toBeVisible();
    expect((await main.calls("search_directory")).at(-1)?.query).toBe("作者B");

    await main.searchBox().fill("   ");
    await expect(main.treeNode("作者A")).toBeVisible();
    await main.page.waitForTimeout(500);
    expect((await main.calls("search_directory")).length).toBe(1);
  });

  test("Esc と × で検索を抜け、元のフォルダの一覧へ戻る", async ({ main }) => {
    await main.openAuthorA();
    await main.searchBox().fill("k1");
    await expect(main.file("k1.zip")).toBeVisible();
    await main.searchBox().press("Escape");
    await expect(main.searchBox()).toHaveValue("");
    await expect(main.file("a1.zip")).toBeVisible();

    await main.searchBox().fill("k1");
    await expect(main.file("k1.zip")).toBeVisible();
    await main.page.getByRole("button", { name: "検索をクリア" }).click();
    await expect(main.file("a1.zip")).toBeVisible();
  });

  test("一致したフォルダを選ぶと、検索を抜けてツリーがそこまで開く", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("シリーズ");
    await main.matchedFolder("シリーズX").click();
    await expect(main.searchBox()).toHaveValue("");
    await expect(main.fileNames()).toHaveText(["x1.zip", "x2.zip", "x3.zip"]);
    expect(await main.treeNames()).toEqual([
      "作者A",
      "完結",
      "シリーズX",
      "連載中",
      "作者B",
      "空フォルダ",
    ]);
    expect(await main.selectedTreeNodes().allTextContents()).toEqual(["シリーズX"]);
  });

  test("お気に入りを切り替えると検索を抜ける", async ({ main }) => {
    await main.favorite("manga").click();
    await main.searchBox().fill("a1");
    await expect(main.fileNames()).toHaveText(["a1.zip", "a1.zip"]);
    await main.favorite("mag").click();
    await expect(main.searchBox()).toHaveValue("");
    await expect(main.fileNames()).toHaveText(["m1.pdf"]);
  });

  test("前の検索語の遅い結果は、あとの検索語の結果を上書きしない", async ({ main }) => {
    await main.favorite("manga").click();
    await main.setMock("delay", "search_directory", 600);
    await main.searchBox().fill("作者");
    await main.page.waitForTimeout(350);
    await main.setMock("delay", "search_directory", null);
    await main.searchBox().fill("k1");
    await expect(main.fileNames()).toHaveText(["k1.zip"]);
    await main.page.waitForTimeout(700);
    await expect(main.fileNames()).toHaveText(["k1.zip"]);
  });

  test.describe("検索に失敗する", () => {
    test.use({ expectedConsoleError: /Search failed/ });

    test("一致なしとは区別して、失敗を知らせる", async ({ main }) => {
      await main.favorite("manga").click();
      await main.setMock("fail", "search_directory", "Failed to search directory: denied");
      await main.searchBox().fill("a1");
      await expect(main.page.locator(".file-list__message--error")).toContainText(
        "検索できませんでした: Failed to search directory: denied",
      );
      await expect(main.page.locator(".file-list__message")).not.toContainText("一致するもの");
    });
  });

  test.describe("階層の深いお気に入り", () => {
    const tree: Record<string, string[]> = { "/r": [] };
    for (let i = 1; i <= 60; i++) {
      const name = `d${String(i).padStart(2, "0")}`;
      tree["/r"].push(`${name}/`);
      tree[`/r/${name}`] = i === 60 ? ["target/"] : [];
    }
    tree["/r/d60/target"] = ["t1.zip"];
    test.use({ mockOptions: { tree, favorites: ["/r"] } });

    test("一致したフォルダへ移ると、ツリーの見える位置までスクロールする", async ({ main }) => {
      await main.favorite("r").click();
      await main.searchBox().fill("target");
      await main.matchedFolder("target").click();
      await expect(main.file("t1.zip")).toBeVisible();
      await expect(main.treeNode("target")).toBeInViewport();
    });
  });
});
