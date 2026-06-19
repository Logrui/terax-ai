# Plan: Favorite Workspaces

## Track ID
`favorite-workspaces`

## Branch
`feat/favorite-workspaces`

## Phase: Implementation

---

### Step 1 -- Settings store: add `favoriteWorkspaces`

**File**: `src/modules/settings/store.ts`

Add to `Preferences` type:
```ts
favoriteWorkspaces: string[];
```

Add constant:
```ts
const KEY_FAVORITE_WORKSPACES = "favoriteWorkspaces";
```

Add to `DEFAULT_PREFERENCES`:
```ts
favoriteWorkspaces: [],
```

Add to `loadPreferences()` return object:
```ts
favoriteWorkspaces:
  get<string[]>(KEY_FAVORITE_WORKSPACES) ?? DEFAULT_PREFERENCES.favoriteWorkspaces,
```

Add setter:
```ts
export async function setFavoriteWorkspaces(value: string[]): Promise<void> {
  await writePref(KEY_FAVORITE_WORKSPACES, value);
}
```

Add to `onPreferencesChange` map:
```ts
[KEY_FAVORITE_WORKSPACES]: "favoriteWorkspaces",
```

Verify: `pnpm exec tsc --noEmit` passes.

---

### Step 2 -- Update `workspaceHistory.ts`

**File**: `src/lib/workspaceHistory.ts`

Add `toggleFavorite` export:
```ts
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
```

No change needed to `addToRecents` -- App.tsx branches on favorites before calling it.

---

### Step 3 -- Tests for `toggleFavorite`

**File**: `src/lib/workspaceHistory.test.ts`

Add a `describe("toggleFavorite", ...)` block covering:
- [ ] Starring a path in recents: removes from recents, prepends to favorites
- [ ] Unstarring a path in favorites: removes from favorites, prepends to recents
- [ ] Starring a path in neither list: adds to favorites, recents unchanged
- [ ] Re-starring an already-favorited path does not duplicate
- [ ] Unstarring respects `addToRecents` install-dir guard (path is skipped)
- [ ] Does not mutate input arrays

Run: `pnpm vitest run src/lib/workspaceHistory.test.ts`

---

### Step 4 -- Update App.tsx

**File**: `src/app/App.tsx`

4a. Import `setFavoriteWorkspaces` from `@/modules/settings/store` and
    `toggleFavorite` from `@/lib/workspaceHistory`.

4b. Read `favoriteWorkspaces` from prefs store:
```ts
const favoriteWorkspaces = usePreferencesStore((s) => s.favoriteWorkspaces);
```

4c. Replace the existing `explorerRoot` effect with one that routes between the two lists:
```ts
useEffect(() => {
  if (!explorerRoot) return;
  if (favoriteWorkspaces.includes(explorerRoot)) {
    const updated = [explorerRoot, ...favoriteWorkspaces.filter((p) => p !== explorerRoot)];
    if (updated[0] !== favoriteWorkspaces[0] || updated.length !== favoriteWorkspaces.length) {
      void setFavoriteWorkspaces(updated);
    }
  } else {
    const updated = addToRecents(recentWorkspaces, explorerRoot);
    if (updated[0] !== recentWorkspaces[0] || updated.length !== recentWorkspaces.length) {
      void setRecentWorkspaces(updated);
    }
  }
  // favoriteWorkspaces and recentWorkspaces intentionally omitted -- only
  // run when explorerRoot changes, not on every store write.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [explorerRoot]);
```

4d. Add `handleToggleFavorite` callback:
```ts
const handleToggleFavorite = useCallback(
  (path: string) => {
    const { favorites, recents } = toggleFavorite(
      favoriteWorkspaces,
      recentWorkspaces,
      path,
    );
    void setFavoriteWorkspaces(favorites);
    void setRecentWorkspaces(recents);
  },
  [favoriteWorkspaces, recentWorkspaces],
);
```

4e. Pass `favoriteWorkspaces` and `onToggleFavorite={handleToggleFavorite}` to
    `WorkspacePicker` and to `StatusBar`.

---

### Step 5 -- Update WorkspacePicker

**File**: `src/modules/workspace/WorkspacePicker.tsx`

Add props:
```ts
favoriteWorkspaces: string[];
onToggleFavorite: (path: string) => void;
```

In the `fs_stat` validation effect, validate favorites and recents together, then split
back into two validated arrays by set membership.

Render two sections with a `group` class on each `<li>` for hover:
```tsx
{validFavorites.length > 0 && (
  <>
    <div className="flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-muted-foreground">
      <HugeiconsIcon icon={StarIcon} className="size-3 fill-amber-400 text-amber-400" strokeWidth={0} />
      Pinned
    </div>
    {validFavorites.map((p, i) => renderRow(p, i, true))}
  </>
)}
{validFavorites.length > 0 && validRecents.length > 0 && (
  <div className="my-1 border-t border-border" />
)}
{validRecents.length > 0 && (
  <>
    <div className="px-1 py-1 text-xs font-medium text-muted-foreground">Recent</div>
    {validRecents.map((p, i) => renderRow(p, validFavorites.length + i, false))}
  </>
)}
```

Star button pattern per row:
```tsx
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onToggleFavorite(p); }}
  className={cn(
    "ml-auto shrink-0 rounded p-0.5 transition-opacity",
    isFavorite
      ? "text-amber-400 opacity-100 hover:text-amber-300"
      : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100",
  )}
>
  <HugeiconsIcon
    icon={StarIcon}
    className={cn("size-3.5", isFavorite && "fill-amber-400")}
    strokeWidth={isFavorite ? 0 : 1.75}
  />
</button>
```

---

### Step 6 -- Update CwdBreadcrumb

**File**: `src/modules/statusbar/CwdBreadcrumb.tsx`

Add to `Props` and `CurrentSegmentDropdown` props:
```ts
favoriteWorkspaces?: string[];
onToggleFavorite?: (path: string) => void;
```

Replace the existing single "Recent" section in `CurrentSegmentDropdown` with the
same two-section (Pinned + Recent) pattern from WorkspacePicker. Use
`DropdownMenuItem` rows with a star button using the same `group` + hover-opacity
pattern. `DropdownMenuItem` needs `onSelect` blocked when the star button is clicked
(`e.preventDefault()` in the star's `onClick` before stopping propagation).

Pass props down from `CwdBreadcrumb` to `CurrentSegmentDropdown`.

---

### Step 7 -- Update StatusBar

**File**: `src/modules/statusbar/StatusBar.tsx`

Add to `Props`:
```ts
onToggleFavorite: (path: string) => void;
```

Read `favoriteWorkspaces` from prefs store (same pattern as `recentWorkspaces`).

Pass both to `CwdBreadcrumb`:
```tsx
<CwdBreadcrumb
  ...
  favoriteWorkspaces={favoriteWorkspaces}
  onToggleFavorite={onToggleFavorite}
/>
```

---

### Step 8 -- Wire StatusBar in App.tsx

**File**: `src/app/App.tsx`

Find the `<StatusBar>` render (~line 1540). Add:
```tsx
onToggleFavorite={handleToggleFavorite}
```

---

### Step 9 -- Verify end-to-end

- [ ] Navigate to 3 directories; open breadcrumb dropdown -- all 3 in "Recent"
- [ ] Hover a recent row in the dropdown -- star icon fades in on right
- [ ] Click the star -- row moves to "Pinned" section, gone from "Recent"
- [ ] Navigate to 8+ more directories -- pinned workspace stays in "Pinned"
- [ ] Hover pinned row -- filled amber star is always visible
- [ ] Click filled star -- workspace moves back to "Recent"
- [ ] Quit and relaunch -- picker shows "Pinned" section above "Recent"
- [ ] Press Ctrl+Shift+R -- picker shows "Pinned" section
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm test`
- [ ] `cd src-tauri && cargo clippy`
- [ ] `cd src-tauri && cargo test --locked`

---

## Estimated Complexity

Low. No new Rust code. 6 files change:
- `store.ts` (additive)
- `workspaceHistory.ts` (additive)
- `workspaceHistory.test.ts` (additive)
- `App.tsx` (update effect + new callback + prop pass-through)
- `WorkspacePicker.tsx` (two-section layout + star button)
- `CwdBreadcrumb.tsx` (two-section layout + star button)
- `StatusBar.tsx` (new prop, pass-through)

## Risk: DropdownMenuItem star click

`DropdownMenuItem` from Radix/shadcn calls `onSelect` and closes the dropdown when
clicked. The star button sits inside the item. Must call `e.preventDefault()` on the
star button's click AND stop propagation to prevent the item from closing the menu
and triggering `onCd`. Test this carefully in Step 9.
