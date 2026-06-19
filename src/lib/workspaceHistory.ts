const INSTALL_DIR_PATTERNS = [
  "program files/terax",
  "program files (x86)/terax",
];

const MAX_RECENT = 8;

export function addToRecents(list: string[], path: string): string[] {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (INSTALL_DIR_PATTERNS.some((p) => lower.includes(p))) return list;
  const deduped = [path, ...list.filter((p) => p !== path)];
  return deduped.slice(0, MAX_RECENT);
}

export function toggleFavorite(
  favorites: string[],
  recents: string[],
  path: string,
): { favorites: string[]; recents: string[] } {
  if (favorites.includes(path)) {
    // Unstar: remove from favorites, prepend to recents (capped at 8)
    return {
      favorites: favorites.filter((p) => p !== path),
      recents: addToRecents(recents, path),
    };
  }
  // Star: remove from recents, prepend to favorites
  return {
    favorites: [path, ...favorites.filter((p) => p !== path)],
    recents: recents.filter((p) => p !== path),
  };
}
