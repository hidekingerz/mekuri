// Tauri の IPC を差し替える e2e 用のモック。Playwright の addInitScript でページに注入する。
// Rust 側の代わりに、この中の仮のファイルツリーと store を読み書きする。
// move_file / trash_* / count_files / search_directory の条件は src-tauri/src/filesystem/mod.rs に合わせてある。
//
// ページから読めるもの:
//   window.__MOCK_CALLS__    すべての invoke 呼び出し（{ cmd, args }）
//   window.__MOCK_FS__       現在のファイルツリー（フォルダ → 子の名前。末尾 "/" がフォルダ）
//   window.__MOCK_STORE__    settings.json の中身（favorites, recentFolders）
//   window.__MOCK_DRAGGED__  read_dragged_paths が返すパス（Finder からのドロップの再現用）
//   window.__MOCK_EMIT__     アプリ内イベントを届ける（別ウィンドウからの通知の再現用）
//   window.__MOCK_MENU__     最後に出たネイティブのコンテキストメニューの項目（text, enabled, checked, separator）
//   window.__MOCK_MENU_CLICK__("文言")  その項目を選んだことにする
//   window.__MOCK_CLOSED__   ウィンドウを閉じる呼び出しがあったか
// 先に window.__MOCK_OPTS__ = { tree, favorites, recentFolders, viewerSettings, archives, dragged,
//   nested: { "<パス>": ["内側1.zip", …] }, broken: { "<パス>": "エラーの文" },
//   fail: { cmd: "message" }, delay: { cmd: ミリ秒 }, monitor: null }
// fail と delay は呼び出しのたびに読むので、先に置いた window.__MOCK_OPTS__ の中身をあとから変えても効く
// を置くと初期値を変えられる。
(() => {
  const opts = window.__MOCK_OPTS__ || {};
  const now = Date.now();
  // フォルダ → 子の名前。末尾 "/" がフォルダ
  const tree = opts.tree || {
    "/m/manga": ["作者A/", "作者B/", "空フォルダ/"],
    "/m/manga/作者A": [
      "完結/",
      "連載中/",
      "a1.zip",
      "a2.zip",
      "a3.zip",
      "a4.cbz",
      "a5.pdf",
      "メモ.txt",
      ".DS_Store",
    ],
    "/m/manga/作者A/完結": ["シリーズX/", "k1.zip"],
    "/m/manga/作者A/完結/シリーズX": ["x1.zip", "x2.zip", "x3.zip"],
    "/m/manga/作者A/連載中": ["a1.zip", "r2.zip"],
    "/m/manga/作者B": ["b1.zip", "b2.zip"],
    "/m/manga/空フォルダ": [],
    "/m/mag": ["月刊Y/", "m1.pdf"],
    "/m/mag/月刊Y": ["y1.pdf", "y2.pdf"],
  };
  const store = {
    favorites: opts.favorites || ["/m/manga", "/m/mag"],
    recentFolders: opts.recentFolders || [],
    ...(opts.viewerSettings ? { viewerSettings: opts.viewerSettings } : {}),
  };
  const isDir = (p) => p in tree;
  const parent = (p) => p.slice(0, p.lastIndexOf("/"));
  const base = (p) => p.slice(p.lastIndexOf("/") + 1);
  const isFile = (p) => (tree[parent(p)] || []).includes(base(p));
  const entry = (dir, name) => {
    const d = name.endsWith("/");
    const n = d ? name.slice(0, -1) : name;
    const path = `${dir}/${n}`;
    return {
      name: n,
      path,
      is_dir: d,
      is_archive: !d && /\.(zip|cbz|rar|cbr)$/i.test(n),
      is_pdf: !d && /\.pdf$/i.test(n),
      has_subfolders: d && (tree[path] || []).some((c) => c.endsWith("/")),
      modified_ms: now,
      size: 1000,
    };
  };
  // 一覧に出るファイル（アーカイブと PDF、隠しファイルを除く）だけを数える（filesystem/mod.rs の count_files）
  const countFiles = (dir) =>
    (tree[dir] || []).reduce(
      (n, c) =>
        c.startsWith(".")
          ? n
          : n +
            (c.endsWith("/")
              ? countFiles(`${dir}/${c.slice(0, -1)}`)
              : /\.(zip|cbz|rar|cbr|pdf)$/i.test(c)
                ? 1
                : 0),
      0,
    );
  const removeDir = (dir) => {
    for (const c of tree[dir] || []) if (c.endsWith("/")) removeDir(`${dir}/${c.slice(0, -1)}`);
    delete tree[dir];
  };
  // opts.archives = { "<アーカイブのパス>": [[名前, 幅, 高さ], ...] }。無いパスは縦長 10 ページ
  const archivePages = (path) => {
    const custom = opts.archives?.[path];
    if (custom) return custom;
    return Array.from({ length: 10 }, (_, i) => [
      `${String(i + 1).padStart(3, "0")}.jpg`,
      700,
      1000,
    ]);
  };
  const menuItems = new Map();
  const callbacks = new Map();
  const listeners = new Map(); // event -> [handler の id]
  const listenerIds = new Map(); // listen が返した id -> handler の id
  let nextId = 1;
  const calls = [];
  window.__MOCK_CALLS__ = calls;
  window.__MOCK_FS__ = tree;
  window.__MOCK_STORE__ = store;
  window.__MOCK_DRAGGED__ = opts.dragged || []; // read_dragged_paths が返すパス（Finder ドロップの再現用）
  const dispatch = (event, payload) => {
    for (const h of listeners.get(event) || []) callbacks.get(h)?.({ event, id: 0, payload });
  };
  window.__MOCK_EMIT__ = dispatch;
  const label = window.__MOCK_LABEL__ || "main";
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label }, currentWebview: { windowLabel: label, label } },
    transformCallback(cb, once) {
      const id = nextId++;
      callbacks.set(id, (p) => {
        if (once) callbacks.delete(id);
        return cb?.(p);
      });
      return id;
    },
    unregisterCallback(id) {
      callbacks.delete(id);
    },
    convertFileSrc: (p) => p,
    async invoke(cmd, args = {}) {
      calls.push({ cmd, args: JSON.parse(JSON.stringify(args ?? {})) });
      if (opts.delay?.[cmd]) await new Promise((resolve) => setTimeout(resolve, opts.delay[cmd]));
      if (opts.fail && cmd in opts.fail) throw opts.fail[cmd];
      switch (cmd) {
        case "plugin:store|load":
          return 1;
        case "plugin:store|get":
          return [store[args.key], args.key in store];
        case "plugin:store|set":
          store[args.key] = args.value;
          return null;
        case "plugin:event|listen": {
          const arr = listeners.get(args.event) || [];
          arr.push(args.handler);
          listeners.set(args.event, arr);
          const eventId = nextId++;
          listenerIds.set(eventId, args.handler);
          return eventId;
        }
        case "plugin:event|emit":
          dispatch(args.event, args.payload);
          return null;
        case "plugin:event|unlisten": {
          const handler = listenerIds.get(args.eventId);
          const arr = listeners.get(args.event) || [];
          listeners.set(
            args.event,
            arr.filter((h) => h !== handler),
          );
          return null;
        }
        case "read_directory": {
          if (!isDir(args.path)) throw `Failed to read directory: ${args.path}`;
          return tree[args.path].filter((c) => !c.startsWith(".")).map((c) => entry(args.path, c));
        }
        case "existing_dirs":
          return args.paths.filter(isDir);
        case "count_files":
          return countFiles(args.path);
        case "read_dragged_paths":
          return window.__MOCK_DRAGGED__;
        case "move_file": {
          // filesystem/mod.rs:168-
          const { src, destDir } = args;
          if (!isFile(src) && !isDir(src)) throw `File does not exist: ${src}`;
          if (!isFile(src)) throw `Path is not a file: ${src}`;
          if (!isDir(destDir)) throw `Destination is not a directory: ${destDir}`;
          if (parent(src) === destDir) throw "Source and destination are the same folder";
          const dest = `${destDir}/${base(src)}`;
          if (tree[destDir].includes(base(src)))
            throw `A file with the same name already exists: ${dest}`;
          tree[parent(src)] = tree[parent(src)].filter((c) => c !== base(src));
          tree[destDir].push(base(src));
          return dest;
        }
        case "trash_file": {
          if (!isFile(args.path)) throw `File does not exist: ${args.path}`;
          tree[parent(args.path)] = tree[parent(args.path)].filter((c) => c !== base(args.path));
          return null;
        }
        case "trash_files": {
          // 全パスを事前検証し、無効なものがあれば何も消さない
          const bad = args.paths.filter((p) => !isFile(p));
          if (bad.length) throw bad.map((p) => `File does not exist: ${p}`).join("\n");
          for (const p of args.paths)
            tree[parent(p)] = tree[parent(p)].filter((c) => c !== base(p));
          return null;
        }
        case "trash_folder": {
          if (!isDir(args.path)) throw `Folder does not exist: ${args.path}`;
          tree[parent(args.path)] = (tree[parent(args.path)] || []).filter(
            (c) => c !== `${base(args.path)}/`,
          );
          removeDir(args.path);
          return null;
        }
        // ---- ビューワー: アーカイブの中身 ----
        // 画像は、ページ番号を描いた SVG（naturalWidth / naturalHeight が指定どおりになる）
        case "analyze_archive_contents": {
          if (opts.broken?.[args.archivePath]) throw opts.broken[args.archivePath];
          const nested = opts.nested?.[args.archivePath];
          if (nested) return { type: "NestedArchives", names: nested };
          const pages = archivePages(args.archivePath);
          return pages.length === 0
            ? { type: "Empty" }
            : { type: "Images", names: pages.map((p) => p[0]) };
        }
        // ネストしたアーカイブは、親のパス + "!/" + 名前 を展開先のパスとして返す
        case "extract_nested_archive": {
          const extracted = `${args.parentPath}!/${args.nestedName}`;
          if (opts.broken?.[extracted]) throw opts.broken[extracted];
          return extracted;
        }
        case "list_archive_images":
          return archivePages(args.archivePath).map((p) => p[0]);
        case "get_archive_image": {
          const pages = archivePages(args.archivePath);
          const index = pages.findIndex((p) => p[0] === args.entryName);
          if (index < 0) throw `Entry not found: ${args.entryName}`;
          const [, w, h] = pages[index];
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${w > h ? "#fde68a" : "#e0f2fe"}" stroke="#111" stroke-width="8"/><text x="50%" y="50%" font-size="${Math.min(w, h) / 3}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${index + 1}</text></svg>`;
          return `data:image/svg+xml;base64,${btoa(svg)}`;
        }
        case "search_directory": {
          // 名前に query を含むものを再帰で集める（filesystem/mod.rs:218-）
          const q = args.query.toLowerCase();
          const out = [];
          const walk = (dir) => {
            for (const c of tree[dir] || []) {
              const e = entry(dir, c);
              if (e.name.toLowerCase().includes(q)) out.push(e);
              if (e.is_dir) walk(e.path);
            }
          };
          walk(args.path);
          return out;
        }
        // ---- ネイティブのコンテキストメニュー ----
        // 作られた項目を覚え、popup されたメニューの中身を window.__MOCK_MENU__ に置く。
        // window.__MOCK_MENU_CLICK__("項目の文言") で、その項目を選んだことにできる
        case "plugin:menu|new": {
          const rid = nextId++;
          const o = args.options || {};
          const id = o.id || `menu-item-${rid}`;
          menuItems.set(rid, {
            rid,
            id,
            kind: args.kind,
            text: o.text ?? null,
            enabled: o.enabled !== false,
            checked: o.checked ?? null,
            separator: o.item === "Separator",
            channel: args.handler?.id ?? null,
            children: (o.items || []).map((i) => (Array.isArray(i) ? i[0] : null)),
          });
          return [rid, id];
        }
        case "plugin:menu|popup": {
          const menu = menuItems.get(args.rid);
          const children = (menu?.children || []).map((rid) => menuItems.get(rid));
          window.__MOCK_MENU__ = children.map(({ text, enabled, checked, separator }) => ({
            text,
            enabled,
            checked,
            separator,
          }));
          window.__MOCK_MENU_CLICK__ = (text) => {
            const item = children.find((i) => i.text === text);
            if (!item) throw new Error(`no menu item: ${text}`);
            if (!item.enabled) return false;
            callbacks.get(item.channel)?.({ message: item.id, index: 0 });
            return true;
          };
          return null;
        }
        case "plugin:window|close":
          window.__MOCK_CLOSED__ = true;
          return null;
        case "plugin:window|get_all_windows":
          return ["main"];
        // 2 倍の画面（論理 1600x1000、メニューバー 25px を除いた作業領域）
        case "plugin:window|current_monitor":
          return opts.monitor === null
            ? null
            : {
                name: "mock",
                scaleFactor: 2,
                position: { x: 0, y: 0 },
                size: { width: 3200, height: 2050 },
                workArea: { position: { x: 0, y: 50 }, size: { width: 3200, height: 2000 } },
              };
        case "plugin:webview|get_all_webviews":
          return [{ windowLabel: "main", label: "main" }];
        case "was_opened_via_file":
          return false;
        case "plugin:updater|check":
          return null;
        default:
          return null;
      }
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
})();
