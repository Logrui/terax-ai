import { describe, expect, it } from "vitest";
import { isImagePath } from "./imageUtils";

describe("isImagePath", () => {
  it.each(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif"])(
    "returns true for .%s",
    (ext) => {
      expect(isImagePath(`/home/user/image.${ext}`)).toBe(true);
    },
  );

  it("is case-insensitive", () => {
    expect(isImagePath("/home/user/photo.PNG")).toBe(true);
    expect(isImagePath("/home/user/icon.SVG")).toBe(true);
    expect(isImagePath("/home/user/anim.GIF")).toBe(true);
  });

  it("returns false for non-image extensions", () => {
    expect(isImagePath("/home/user/script.ts")).toBe(false);
    expect(isImagePath("/home/user/lib.rs")).toBe(false);
    expect(isImagePath("/home/user/README.md")).toBe(false);
    expect(isImagePath("/home/user/data.json")).toBe(false);
    expect(isImagePath("/home/user/archive.zip")).toBe(false);
    expect(isImagePath("/home/user/binary.wasm")).toBe(false);
  });

  it("handles Windows backslash paths", () => {
    expect(isImagePath("C:\\Users\\me\\photo.jpg")).toBe(true);
    expect(isImagePath("C:\\Users\\me\\script.ts")).toBe(false);
  });

  it("handles paths with no extension", () => {
    expect(isImagePath("/home/user/Makefile")).toBe(false);
    expect(isImagePath("/home/user/")).toBe(false);
  });

  it("handles dotfiles correctly", () => {
    expect(isImagePath("/home/user/.env")).toBe(false);
    expect(isImagePath("/home/user/.hidden")).toBe(false);
  });
});
