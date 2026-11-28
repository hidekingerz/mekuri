import { describe, expect, it } from "vitest";
import { CASCADE_STEP, cascadePositions } from "./windowCascade";

const screen = { x: 0, y: 25, width: 1600, height: 1000 };
const size = { width: 1000, height: 800 };

describe("cascadePositions", () => {
  it("places each window one step down and to the right of the previous one", () => {
    const [a, b, c] = cascadePositions(3, screen, size);
    expect(b).toEqual({ x: a.x + CASCADE_STEP, y: a.y + CASCADE_STEP });
    expect(c).toEqual({ x: b.x + CASCADE_STEP, y: b.y + CASCADE_STEP });
  });

  it("centers the whole stack in the screen area", () => {
    const positions = cascadePositions(3, screen, size);
    const last = positions[2];
    // 左の余白 = 右の余白、上の余白 = 下の余白
    expect(positions[0].x - screen.x).toBe(screen.x + screen.width - (last.x + size.width));
    expect(positions[0].y - screen.y).toBe(screen.y + screen.height - (last.y + size.height));
  });

  it("keeps every window inside the screen area", () => {
    for (const p of cascadePositions(30, screen, size)) {
      expect(p.x).toBeGreaterThanOrEqual(screen.x);
      expect(p.y).toBeGreaterThanOrEqual(screen.y);
      expect(p.x + size.width).toBeLessThanOrEqual(screen.x + screen.width);
      expect(p.y + size.height).toBeLessThanOrEqual(screen.y + screen.height);
    }
  });

  it("starts over from the first position when the steps run out of room", () => {
    // 縦の余裕は 200px。28px ずつなら 7 段までずらせるので、9 枚目は 1 枚目と同じ位置に戻る
    const positions = cascadePositions(9, screen, size);
    expect(positions[8]).toEqual(positions[0]);
    expect(positions[7]).not.toEqual(positions[0]);
  });

  it("still shifts sideways when the window is as tall as the screen area", () => {
    const [a, b] = cascadePositions(2, screen, { width: 1000, height: 1000 });
    expect(b).toEqual({ x: a.x + CASCADE_STEP, y: a.y });
  });

  it("puts a single window in the center", () => {
    expect(cascadePositions(1, screen, size)).toEqual([{ x: 300, y: 125 }]);
  });

  it("offsets from the screen origin on a second display", () => {
    const [p] = cascadePositions(1, { x: 1600, y: 0, width: 1600, height: 1000 }, size);
    expect(p).toEqual({ x: 1900, y: 100 });
  });
});
