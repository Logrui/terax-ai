# Spec: Recent Workspaces

## Track ID
`saved-workspaces`

## Status
`planning`

## Problem

When Terax is launched from the Start Menu (or any shortcut with no CLI argument),
`initLaunchDir()` falls back to the process CWD -- `C:\Program Files\Terax\` for a
perMachine install. There is no memory of where the user was last working, and no
way to quickly switch between known project roots without using the terminal.

## Goal

1. Persist a deduplicated list of up to 8 recent workspace roots in the settings store.
2. On cold open (no CLI argument), show a workspace picker overlay so the user
   actively chooses a workspace; the last workspace is pre-selected if the app
   previously quit cleanly, otherwise no pre-selection.
3. Surface the recent list via a command palette entry and a header dropdown on
   the current directory breadcrumb.

## In Scope

- `recentWorkspaces: string[]` field in Preferences (max 8, deduplicated, most-recent-first)
- `lastQuitClean: boolean` field in Preferences (set false at boot, true on beforeunload)
- Write to the list whenever the file explorer root changes (not on every `cd`)
- WorkspacePicker overlay shown at cold open when the list is non-empty and no CLI arg
- Header breadcrumb gains a chevron that opens the recent list as a dropdown
- "Open Recent Workspace" command palette entry (Ctrl+Shift+R)
- "Open Folder..." button in the picker to browse for an unlisted path (reuses existing
  folder-open logic)
- Graceful fallback: skip missing paths silently; fall back to home dir if list is empty

## Out of Scope (this track)

- Pinned/starred workspaces
- Per-workspace settings or state
- Recent files within a workspace
- Syncing across machines

## User Stories

1. As a developer, when I launch Terax from the Start Menu, I see a workspace picker
   showing my recent projects and can open one with a single click or keyboard selection.
2. If the app previously quit cleanly, the last workspace is pre-selected so I can press
   Enter to restore it instantly.
3. If the app crashed, no workspace is pre-selected -- I choose explicitly.
4. As a developer working across multiple projects, I press Ctrl+Shift+R to open the
   recent workspaces list without leaving the keyboard.
5. Clicking the current directory breadcrumb chevron in the header opens a dropdown of
   recent workspaces for quick switching mid-session.
6. When Terax is launched with `terax /path/to/project`, the picker is skipped entirely.
7. If a recent workspace directory no longer exists, it is silently removed from the list.

## Non-Goals

- No settings UI for workspace history
- No pinned/starred entries
- No sync across machines

## Technical Approach

### Data (settings store)

`src/modules/settings/store.ts`:
- `recentWorkspaces: string[]` -- max 8, most-recent-first, deduplicated by exact path
- `lastQuitClean: boolean` -- false at boot, true on window beforeunload

### Write side

`App.tsx`: effect on `explorerRoot` changes -- prepend to list, dedup, cap at 8,
call `setRecentWorkspaces(updated)`. Skip paths that match the install directory pattern
(`C:\Program Files\Terax\` or equivalent) to avoid poisoning the list on first launch.

`src/main.tsx` (early): call `setLastQuitClean(false)` to mark the session as unclean
until proven otherwise.
`window.addEventListener("beforeunload", ...)`: call `setLastQuitClean(true)`.

### WorkspacePicker overlay

New component: `src/modules/workspace/WorkspacePicker.tsx`

Shown in `App.tsx` when: no CLI launch dir AND `recentWorkspaces.length > 0` AND
workspace not yet chosen.

Behavior:
- Full-screen translucent overlay (matches existing Terax modal style)
- Lists recent workspaces: project name (last path segment) + full path in muted text
- If `lastQuitClean === true`: pre-select index 0 (most recent)
- If `lastQuitClean === false`: no pre-selection
- Keyboard: arrow keys move selection, Enter to open, Escape to dismiss (falls back to home)
- "Open Folder..." button invokes existing folder-browse dialog
- Filters out paths that fail `fs_stat` silently at render time

### Header dropdown

`src/modules/header/`: add a small chevron button next to the cwd breadcrumb. On click,
renders a `<RecentWorkspacesDropdown>` -- same list data, inline popover style.
Check for conflicts with any existing breadcrumb onClick (cwd copy to clipboard).

### Command palette

Register `open-recent-workspace` in `src/modules/shortcuts/shortcuts.ts`.
Default binding: `Ctrl+Shift+R`. Opens WorkspacePicker (or the dropdown if already
in a session with workspaces loaded).

### `initLaunchDir` changes

`launchDir.ts` exposes only whether a CLI arg was provided. The picker logic moves
into React (App startup state + WorkspacePicker). No new Rust commands needed.

```
CLI arg present  ->  skip picker, use arg directly
no CLI arg       ->  React shows WorkspacePicker (if list non-empty)
                     picker resolves  ->  set as workspace root
                     Escape / list empty  ->  home dir fallback
```

## Open Questions

- [ ] Does the header breadcrumb already have an onClick? Check for conflicts with
      existing cwd-copy-to-clipboard behavior before adding the chevron.
- [ ] Should the picker be a true modal (blocks interaction) or a dismissible overlay
      that lets the user click past it into the app?
