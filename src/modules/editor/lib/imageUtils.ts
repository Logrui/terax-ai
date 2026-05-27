const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
  "avif",
]);

export function isImagePath(path: string): boolean {
  const ext = path.split(/[./\\]/).pop()?.toLowerCase() ?? "";
  return IMAGE_EXTS.has(ext);
}
