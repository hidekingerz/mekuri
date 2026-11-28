import { describe, expect, it } from "vitest";
import { compareNatural } from "./naturalOrder";

const sorted = (names: string[]) => [...names].sort(compareNatural);

// Rust 側（src-tauri/src/natural_order.rs）のテストと同じ入力・同じ期待値
describe("compareNatural", () => {
  it("orders numbers by value", () => {
    expect(sorted(["10.jpg", "2.jpg", "1.jpg"])).toEqual(["1.jpg", "2.jpg", "10.jpg"]);
  });

  it("orders zero-padded numbers by value too", () => {
    expect(sorted(["10.jpg", "03.jpg", "1.jpg", "02.jpg"])).toEqual([
      "1.jpg",
      "02.jpg",
      "03.jpg",
      "10.jpg",
    ]);
    expect(sorted(["p010.jpg", "p9.jpg", "p8.jpg"])).toEqual(["p8.jpg", "p9.jpg", "p010.jpg"]);
    expect(sorted(["page10", "page001", "page2", "page02"])).toEqual([
      "page001",
      "page2",
      "page02",
      "page10",
    ]);
  });

  it("ignores case", () => {
    expect(sorted(["B2.png", "a10.JPG", "b1.jpg", "A2.jpg", "a1.jpg"])).toEqual([
      "a1.jpg",
      "A2.jpg",
      "a10.JPG",
      "b1.jpg",
      "B2.png",
    ]);
  });

  it("handles numbers longer than any number type", () => {
    const big = "9".repeat(40);
    const bigger = `1${"0".repeat(40)}`;
    expect(compareNatural(big, bigger)).toBe(-1);
    expect(compareNatural(bigger, big)).toBe(1);
  });

  it("puts a name before a longer name that starts with it", () => {
    expect(sorted(["vol1b", "vol1", "vol"])).toEqual(["vol", "vol1", "vol1b"]);
  });

  it("keeps non-ASCII names in code point order", () => {
    expect(sorted(["第2巻.zip", "第10巻.zip", "第1巻.zip", "あ.zip"])).toEqual([
      "あ.zip",
      "第1巻.zip",
      "第2巻.zip",
      "第10巻.zip",
    ]);
  });

  it("gives names that differ only in padding or case one fixed order", () => {
    expect(sorted(["01", "1", "001"])).toEqual(["1", "01", "001"]);
    expect(sorted(["a.jpg", "A.jpg"])).toEqual(["A.jpg", "a.jpg"]);
    expect(compareNatural("a b", "ab")).toBe(-1);
    expect(compareNatural("same", "same")).toBe(0);
  });

  it("compares in both directions, not only the way a sort happens to ask", () => {
    for (const [smaller, larger] of [
      ["vol1", "vol1b"],
      ["a1", "ab"], // 数字は文字より前
      ["a-10", "a.5"], // 記号は数字の一部として読まない
      ["1a0", "1b"], // 数字のあとの文字は数値に含めない
      ["2", "10"],
      ["12", "13"], // 桁数が同じ数字は、上の桁から比べる
      ["9", "010"],
      ["a2", "A10"],
      ["1x", "001y"], // ゼロ埋めの違いより、あとの文字の違いが先
      ["a10", "ab"], // 複数桁の数字も、文字より前
      ["001", "2"], // 先頭のゼロは何個あっても無視する
      ["", "a"],
      ["i", "İ"], // 小文字にすると 2 文字になる文字は、その 1 文字目が同じ文字のあと
    ]) {
      expect([smaller, larger, compareNatural(smaller, larger)]).toEqual([smaller, larger, -1]);
      expect([larger, smaller, compareNatural(larger, smaller)]).toEqual([larger, smaller, 1]);
    }
  });

  it("uses the first spelling difference when everything else is equal", () => {
    // 1 つ目の数字はゼロ埋めの少ないほうが先。2 つ目の違いでは覆らない
    expect(compareNatural("1a01", "01a1")).toBe(-1);
    expect(compareNatural("01a1", "1a01")).toBe(1);
    // 大文字小文字の違いも、最初の箇所で決まる
    expect(compareNatural("Ab", "aB")).toBe(-1);
    expect(compareNatural("", "")).toBe(0);
  });

  it("treats characters outside the basic plane as one character", () => {
    expect(compareNatural("😀1", "😀2")).toBe(-1);
    expect(compareNatural("a😀", "a😁")).toBe(-1);
  });
});
