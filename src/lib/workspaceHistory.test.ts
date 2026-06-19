import { describe, expect, it } from "vitest";
import { addToRecents, toggleFavorite } from "./workspaceHistory";

describe("addToRecents", () => {
  it("prepends a new path to the front", () => {
    const result = addToRecents(["/a", "/b"], "/c");
    expect(result).toEqual(["/c", "/a", "/b"]);
  });

  it("moves an existing path to the front (dedup)", () => {
    const result = addToRecents(["/a", "/b", "/c"], "/b");
    expect(result).toEqual(["/b", "/a", "/c"]);
  });

  it("caps the list at 8 entries", () => {
    const list = ["/1", "/2", "/3", "/4", "/5", "/6", "/7", "/8"];
    const result = addToRecents(list, "/9");
    expect(result).toHaveLength(8);
    expect(result[0]).toBe("/9");
    expect(result).not.toContain("/8");
  });

  it("handles an empty list", () => {
    const result = addToRecents([], "/new");
    expect(result).toEqual(["/new"]);
  });

  it("does not mutate the input array", () => {
    const input = ["/a", "/b"];
    addToRecents(input, "/c");
    expect(input).toEqual(["/a", "/b"]);
  });

  it("skips C:\\Program Files\\Terax paths (case-insensitive)", () => {
    const result = addToRecents([], "C:\\Program Files\\Terax");
    expect(result).toEqual([]);
  });

  it("skips Program Files (x86)\\Terax paths", () => {
    const result = addToRecents(["/a"], "C:\\Program Files (x86)\\Terax");
    expect(result).toEqual(["/a"]);
  });

  it("skips install dir regardless of case", () => {
    const result = addToRecents([], "C:\\PROGRAM FILES\\TERAX");
    expect(result).toEqual([]);
  });

  it("does not skip unrelated paths containing 'terax'", () => {
    const result = addToRecents([], "/home/user/terax-project");
    expect(result).toEqual(["/home/user/terax-project"]);
  });
});

describe("toggleFavorite", () => {
  it("starring a path in recents removes it from recents and prepends to favorites", () => {
    const { favorites, recents } = toggleFavorite([], ["/a", "/b"], "/a");
    expect(favorites).toEqual(["/a"]);
    expect(recents).toEqual(["/b"]);
  });

  it("unstarring a favorite removes it from favorites and prepends to recents", () => {
    const { favorites, recents } = toggleFavorite(["/a"], ["/b"], "/a");
    expect(favorites).toEqual([]);
    expect(recents).toEqual(["/a", "/b"]);
  });

  it("starring a path in neither list adds to favorites, recents unchanged", () => {
    const { favorites, recents } = toggleFavorite([], ["/a"], "/new");
    expect(favorites).toEqual(["/new"]);
    expect(recents).toEqual(["/a"]);
  });

  it("toggle is symmetric: star then unstar returns original recents", () => {
    const { favorites: f1, recents: r1 } = toggleFavorite([], ["/a", "/b"], "/a");
    const { favorites: f2, recents: r2 } = toggleFavorite(f1, r1, "/a");
    expect(f2).toEqual([]);
    expect(r2).toEqual(["/a", "/b"]);
  });

  it("unstarring an install-dir path is a no-op in addToRecents (skipped)", () => {
    const { favorites, recents } = toggleFavorite(
      ["C:\\Program Files\\Terax"],
      ["/a"],
      "C:\\Program Files\\Terax",
    );
    expect(favorites).toEqual([]);
    // addToRecents skips install dirs, so recents stays unchanged
    expect(recents).toEqual(["/a"]);
  });

  it("does not mutate input arrays", () => {
    const favs = ["/a"];
    const recs = ["/b"];
    toggleFavorite(favs, recs, "/b");
    expect(favs).toEqual(["/a"]);
    expect(recs).toEqual(["/b"]);
  });
});
