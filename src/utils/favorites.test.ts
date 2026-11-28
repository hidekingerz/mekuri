import { describe, expect, it } from "vitest";
import { favoritesInside } from "./favorites";

describe("favoritesInside", () => {
  const favorites = ["/m/manga", "/m/manga/A", "/m/manga/A/done", "/m/manga/AB", "/m/mag"];

  it("returns the folder itself and favorites below it", () => {
    expect(favoritesInside(favorites, "/m/manga/A")).toEqual(["/m/manga/A", "/m/manga/A/done"]);
  });

  it("does not take a sibling that only shares a name prefix", () => {
    expect(favoritesInside(favorites, "/m/manga/A")).not.toContain("/m/manga/AB");
  });

  it("does not take a favorite above the folder", () => {
    expect(favoritesInside(favorites, "/m/manga/A/done")).toEqual(["/m/manga/A/done"]);
  });

  it("returns nothing when no favorite is inside", () => {
    expect(favoritesInside(favorites, "/m/manga/B")).toEqual([]);
  });
});
