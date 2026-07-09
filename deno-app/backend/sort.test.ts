import { assertEquals } from "@std/assert";
import { naturalCompare, naturalSort } from "./sort.ts";

Deno.test("naturalSort orders numeric chunks numerically", () => {
  const input = ["img10.png", "img2.png", "img1.png", "img20.png"];
  assertEquals(naturalSort(input), [
    "img1.png",
    "img2.png",
    "img10.png",
    "img20.png",
  ]);
});

Deno.test("naturalSort handles leading-zero padding consistently", () => {
  const input = ["p008.jpg", "p10.jpg", "p9.jpg"];
  assertEquals(naturalSort(input), ["p008.jpg", "p9.jpg", "p10.jpg"]);
});

Deno.test("naturalCompare returns 0 for equal strings", () => {
  assertEquals(naturalCompare("page1", "page1"), 0);
});

Deno.test("naturalCompare orders plain strings lexicographically", () => {
  assertEquals(naturalCompare("a.png", "b.png") < 0, true);
  assertEquals(naturalCompare("b.png", "a.png") > 0, true);
});

Deno.test("naturalSort does not mutate the input", () => {
  const input = ["b", "a"];
  naturalSort(input);
  assertEquals(input, ["b", "a"]);
});
