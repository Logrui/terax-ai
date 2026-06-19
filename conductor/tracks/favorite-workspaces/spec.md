# Spec: Favorite Workspaces

## Track ID
`favorite-workspaces`

## Status
`planning`

## Problem

The recent workspaces list is capped at 8 entries and evicts oldest entries on overflow.
Projects a developer returns to repeatedly -- a main client repo, a personal config dir --
get pushed out by incidental navigation and have to be re-discovered. There is no way to
keep a workspace permanently accessible without visiting it constantly.

## Goal

Let users star any workspace to pin it permanently. Favorites are immune to the 8-item
recents cap, sorted by most-recently-visited (same dynamic ordering as recents), and
appear in a dedicated "Pinned" section above the recents list in both the startup picker
and the breadcrumb dropdown. Starring/unstarring is done via a hover-reveal star icon
on each workspace row.

## In Scope

- `favoriteWorkspaces: string[]` field in Preferences -- paths ordered by most-recent
  visit, no cap, persisted in the settings store
- Favorites are removed from the recents list and shown only in the "Pinned" section
- Visiting a favorited workspace updates its position in `favoriteWorkspaces` (move to
  front), same dynamic ordering as recents
- Starring a recent: moves it out of `recentWorkspaces` and into `favoriteWorkspaces`
- Unstarring a favorite: moves it back into the front of `recentWorkspaces`
- Star affordance in WorkspacePicker: outline star appears on hover for un-favorited
  rows; filled star is always visible on favorited rows
- Same affordance in CwdBreadcrumb dropdown "Pinned/Recent" sections
- `workspaceHistory.ts` updated: visiting a favorited path updates its position in
  `favoriteWorkspaces` instead of `recentWorkspaces`
- New pure function `toggleFavorite` handles the atomic move between the two lists

## Out of Scope (this track)

- Manual drag-and-drop reordering of favorites
- Per-workspace metadata (notes, color labels)
- Cap on the number of favorites
- Syncing across machines

## User Stories

1. As a developer, I hover over a workspace in the picker or breadcrumb dropdown and
   see a star icon appear on the right of the row. Clicking it pins the workspace to
   the "Pinned" section.
2. Pinned workspaces appear above the recents list in both the startup picker and the
   breadcrumb dropdown, under a "Pinned" header with a filled star icon, separated from
   recents by a divider.
3. Pinned workspaces never disappear from the list regardless of how many other
   directories I visit.
4. When I visit a pinned workspace again, it moves to the top of the "Pinned" section
   (most-recently-visited ordering, same as recents).
5. I can unstar a workspace by clicking its filled star; it moves back into the recents
   list at the top.
6. Non-favorited recents still show their hover star so I can favorite them in one click.

## Non-Goals

- No drag-and-drop reordering
- No cap on favorites in this track
- No color/emoji labeling

## Technical Approach

### Data

`src/modules/settings/store.ts`:
- Add `favoriteWorkspaces: string[]` to `Preferences` -- most-recently-visited first,
  no cap, default `[]`
- Existing `recentWorkspaces` stores only non-favorited paths (favorites are removed
  from it when starred)

### Pure utilities (`src/lib/workspaceHistory.ts`)

New export:
```ts
export function toggleFavorite(
  favorites: string[],
  recents: string[],
  path: string,
): { favorites: string[]; recents: string[] } {
  if (favorites.includes(path)) {
    // Unstar: remove from favorites, prepend to recents (capped)
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

Update `addToRecents` signature to accept an optional `favorites` set so visiting a
favorited path updates its position in favorites rather than recents:
```ts
export function addToRecents(
  list: string[],
  path: string,
  favorites?: string[],
): string[]
```
If `favorites?.includes(path)` the caller handles the favorites update separately;
`addToRecents` simply returns the list unchanged for that path.

### WorkspacePicker

Add props:
- `favoriteWorkspaces: string[]`
- `onToggleFavorite: (path: string) => void`

Render two sections:
- "Pinned" -- from `favoriteWorkspaces` (validated paths only)
- "Recent" -- from `recentWorkspaces` excluding any in `favoriteWorkspaces`

Each row: `group` class on the `<li>`, star button with
`opacity-0 group-hover:opacity-100` for un-favorited rows; always-visible filled star
for favorited rows.

### CwdBreadcrumb dropdown

Same two-section treatment with identical star affordance.
Pass `favoriteWorkspaces` + `onToggleFavorite` through `StatusBar` -> `CwdBreadcrumb`
-> `CurrentSegmentDropdown`.

### App.tsx

- Read `favoriteWorkspaces` from prefs store
- Update `explorerRoot` effect to route between the two lists:
  ```ts
  if (favorites.includes(explorerRoot)) {
    const updated = [explorerRoot, ...favorites.filter(p => p !== explorerRoot)];
    void setFavoriteWorkspaces(updated);
  } else {
    void setRecentWorkspaces(addToRecents(recents, explorerRoot));
  }
  ```
- `handleToggleFavorite(path)` callback: calls `toggleFavorite`, then writes both
  `setFavoriteWorkspaces` and `setRecentWorkspaces`

## Open Questions

- [ ] Should the "Pinned" section show in the breadcrumb dropdown even when empty, or
      only appear once at least one workspace is favorited? (Prefer: hide when empty.)
- [ ] Should `fs_stat` validation in WorkspacePicker also filter stale favorite paths?
      (Yes -- same logic as recents.)
