import { assertEquals } from "@std/assert";
import {
  type ArchiveReader,
  clearArchiveCache,
  readArchiveBytes,
} from "./cache.ts";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** 呼び出し回数とパスを記録するスパイ reader を作る。 */
function spyReader(table: Record<string, string>): {
  reader: ArchiveReader;
  calls: string[];
} {
  const calls: string[] = [];
  const reader: ArchiveReader = (path) => {
    calls.push(path);
    return Promise.resolve(bytes(table[path] ?? ""));
  };
  return { reader, calls };
}

Deno.test("readArchiveBytes は同一 path の連続要求で reader を 1 回しか呼ばない", async () => {
  clearArchiveCache();
  const { reader, calls } = spyReader({ "/a.zip": "AAA" });

  const first = await readArchiveBytes("/a.zip", reader);
  const second = await readArchiveBytes("/a.zip", reader);
  const third = await readArchiveBytes("/a.zip", reader);

  assertEquals(calls, ["/a.zip"]);
  assertEquals(first, bytes("AAA"));
  assertEquals(second, bytes("AAA"));
  assertEquals(third, bytes("AAA"));
});

Deno.test("readArchiveBytes は別 path はそれぞれ 1 回読む", async () => {
  clearArchiveCache();
  const { reader, calls } = spyReader({ "/a.zip": "AAA", "/b.zip": "BBB" });

  assertEquals(await readArchiveBytes("/a.zip", reader), bytes("AAA"));
  assertEquals(await readArchiveBytes("/b.zip", reader), bytes("BBB"));
  // どちらも一度キャッシュされたので再読込しない。
  await readArchiveBytes("/a.zip", reader);
  await readArchiveBytes("/b.zip", reader);

  assertEquals(calls, ["/a.zip", "/b.zip"]);
});

Deno.test("readArchiveBytes は容量超過で最古を退避する（LRU 2 件）", async () => {
  clearArchiveCache();
  const { reader, calls } = spyReader({
    "/a.zip": "AAA",
    "/b.zip": "BBB",
    "/c.zip": "CCC",
  });

  await readArchiveBytes("/a.zip", reader); // [a]
  await readArchiveBytes("/b.zip", reader); // [a, b]
  await readArchiveBytes("/c.zip", reader); // a を退避 → [b, c]
  await readArchiveBytes("/a.zip", reader); // a は退避済みで再読込

  assertEquals(calls, ["/a.zip", "/b.zip", "/c.zip", "/a.zip"]);
});

Deno.test("readArchiveBytes はヒットでエントリを最近使用へ移動する", async () => {
  clearArchiveCache();
  const { reader, calls } = spyReader({
    "/a.zip": "AAA",
    "/b.zip": "BBB",
    "/c.zip": "CCC",
  });

  await readArchiveBytes("/a.zip", reader); // [a]
  await readArchiveBytes("/b.zip", reader); // [a, b]
  await readArchiveBytes("/a.zip", reader); // a ヒット → [b, a]
  await readArchiveBytes("/c.zip", reader); // b を退避 → [a, c]
  await readArchiveBytes("/a.zip", reader); // a は残っているので再読込しない

  assertEquals(calls, ["/a.zip", "/b.zip", "/c.zip"]);
});

Deno.test("clearArchiveCache 後は再度 reader を呼ぶ", async () => {
  clearArchiveCache();
  const { reader, calls } = spyReader({ "/a.zip": "AAA" });

  await readArchiveBytes("/a.zip", reader);
  clearArchiveCache();
  await readArchiveBytes("/a.zip", reader);

  assertEquals(calls, ["/a.zip", "/a.zip"]);
});
