# Plan: Recent Workspaces

## Track ID
`saved-workspaces`

## Branch
`feat/saved-workspaces`

## Phase: Implementation

---

### Step 1 -- Settings store: add `recentWorkspaces` + `lastQuitClean`

**File**: `src/modules/settings/store.ts`

Add to `Preferences` type:
```ts
recentWorkspaces: string[];
lastQuitClean: boolean;
```

Add constants:
```ts
const KEY_RECENT_WORKSPACES = "recentWorkspaces";
const KEY_LAST_QUIT_CLEAN   = "lastQuitClean";
```

Add to `DEFAULT_PREFERENCES`:
```ts
recentWorkspaces: [],
lastQuitClean: false,
```

Add to `loadPreferences()` return object:
```ts
recentWorkspaces: get<string[]>(KEY_RECENT_WORKSPACES) ?? [],
lastQuitClean:    get<boolean>(KEY_LAST_QUIT_CLEAN) ?? false,
```

Add setters:
```ts
export async function setRecentWorkspaces(value: string[]): Promise<void> {
  await writePref(KEY_RECENT_WORKSPACES, value);
}

export async function setLastQuitClean(value: boolean): Promise<void> {
  await writePref(KEY_LAST_QUIT_CLEAN, value);
}
```

Add to `onPreferencesChange` map:
```ts
[KEY_RECENT_WORKSPACES]: "recentWorkspaces",
[KEY_LAST_QUIT_CLEAN]:   "lastQuitClean",
```

Verify: `pnpm exec tsc --noEmit` passes.

---

### Step 2 -- Expose CLI-arg detection in `launchDir.ts`

**File**: `src/lib/launchDir.ts`

Add a second module-level variable to track whether the launch dir came from a CLI
argument (as opposed to process CWD):

```ts
let fromCliArg = false;

export function hadCliArg(): boolean {
  return fromCliArg;
}
```

In `initLaunchDir()`, after `get_launch_dir` returns a non-null result, set
`fromCliArg = true`. This lets App decide whether to skip the picker without a
second Tauri invoke.

---

### Step 3 -- Session clean-quit tracking

**File**: `src/main.tsx`

After `initLaunchDir()` resolves, mark the session as unclean:
```ts
await setLastQuitClean(false);
```

After the Tauri window `show()` call, register a beforeunload listener that marks
a clean exit:
```ts
window.addEventListener("beforeunload", () => {
  void setLastQuitClean(true);
});
```

`LazyStore` auto-saves within 200 ms; on a normal quit the OS flushes the write
before the process exits. On a crash, `lastQuitClean` remains `false`.

---

### Step 4 -- Write recent workspaces on explorer root change

**File**: `src/lib/workspaceHistory.ts` (new)

Pure utility -- no side effects, no imports:
```ts
const INSTALL_DIR_PATTERNS = [
  "program files/terax",
  "program files (x86)/terax",
];

export function addToRecents(list: string[], path: string): string[] {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (INSTALL_DIR_PATTERNS.some((p) => lower.includes(p))) return list;
  const deduped = [path, ...list.filter((p) => p !== path)];
  return deduped.slice(0, 8);
}
```

**File**: `src/app/App.tsx`

Import `addToRecents`, `setRecentWorkspaces`, and read `recentWorkspaces` from
`usePreferencesStore`. Add effect below the existing `explorerRoot` usage:

```ts
const recentWorkspaces = usePreferencesStore((s) => s.recentWorkspaces);

useEffect(() => {
  if (!explorerRoot) return;
  const updated = addToRecents(recentWorkspaces, explorerRoot);
  // skip write when nothing changed
  if (updated.length === recentWorkspaces.length && updated[0] === recentWorkspaces[0]) return;
  void setRecentWorkspaces(updated);
}, [explorerRoot]);
```

---

### Step 5 -- WorkspacePicker component

**File**: `src/modules/workspace/WorkspacePicker.tsx` (new)

```ts
type Props = {
  workspaces: string[];
  preSelectFirst: boolean;   // true when lastQuitClean === true
  onSelect: (path: string) => void;
  onDismiss: () => void;
};
```

Behavior:
- Full-screen overlay: `fixed inset-0 z-50 bg-background/80 backdrop-blur-sm`
- Centered card: title "Recent Workspaces", max-w-md
- On mount: filter `workspaces` via `invoke("fs_stat", { path })` for each entry;
  remove paths that throw; store valid list in local state
- Render each as a button: bold project name (last path segment) + muted truncated
  full path below
- `preSelectFirst` → `selectedIndex` state starts at 0; else starts at -1
- Keyboard: `ArrowDown`/`ArrowUp` move `selectedIndex`; `Enter` calls
  `onSelect(valid[selectedIndex])`; `Escape` calls `onDismiss()`
- "Open Folder..." button at bottom: calls
  `open({ directory: true })` from `@tauri-apps/plugin-dialog`
  and passes the result to `onSelect`

**File**: `src/modules/workspace/index.ts`

Export `WorkspacePicker`.

---

### Step 6 -- Wire picker in App.tsx

**File**: `src/app/App.tsx`

Import `hadCliArg` from `@/lib/launchDir`, `WorkspacePicker` from
`@/modules/workspace`, and `lastQuitClean` from `usePreferencesStore`.

Add state:
```ts
const [pickerDismissed, setPickerDismissed] = useState(false);
```

Derive show condition:
```ts
const showPicker =
  !hadCliArg() && !pickerDismissed && recentWorkspaces.length > 0;
```

Render at root of App layout (above the pane split, not inside a tab):
```tsx
{showPicker && (
  <WorkspacePicker
    workspaces={recentWorkspaces}
    preSelectFirst={lastQuitClean}
    onSelect={(path) => {
      setPickerDismissed(true);
      openTabWithCwd(path);   // reuse existing new-terminal-tab logic
    }}
    onDismiss={() => setPickerDismissed(true)}
  />
)}
```

The picker is dismissed after one interaction and does not reappear within the session
unless re-triggered by the shortcut (Step 8).

---

### Step 7 -- Recent workspaces in CwdBreadcrumb dropdown

**File**: `src/modules/statusbar/CwdBreadcrumb.tsx`

Add `recentWorkspaces?: string[]` to the `Props` type and to
`CurrentSegmentDropdown`'s props.

Inside `CurrentSegmentDropdown`, after the existing subdirectory list, add a "Recent"
section:
```tsx
{recentWorkspaces && recentWorkspaces.length > 0 && (
  <>
    <DropdownMenuSeparator />
    <div className="px-2 py-1 text-xs text-muted-foreground">Recent</div>
    {recentWorkspaces.map((p) => (
      <DropdownMenuItem key={p} onSelect={() => onCd(p)}>
        <HugeiconsIcon icon={Folder01Icon} className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
        <span className="truncate font-medium">{basename(p)}</span>
        <span className="ml-auto max-w-[120px] truncate text-xs text-muted-foreground">{p}</span>
      </DropdownMenuItem>
    ))}
  </>
)}
```

**File**: `src/modules/statusbar/StatusBar.tsx`

Read `recentWorkspaces` from `usePreferencesStore` and pass it to `CwdBreadcrumb`.

---

### Step 8 -- Keyboard shortcut: "Open Recent Workspace"

**File**: `src/modules/shortcuts/shortcuts.ts`

Add to `ShortcutId` union:
```ts
| "workspace.openRecent"
```

Add to `SHORTCUTS` array:
```ts
{
  id: "workspace.openRecent",
  label: "Open Recent Workspace",
  group: "General",
  defaultBindings: [{ key: "r", ctrl: true, shift: true }],
},
```

**File**: `src/app/App.tsx`

In the global shortcut handler, handle `"workspace.openRecent"`:
```ts
case "workspace.openRecent":
  if (recentWorkspaces.length > 0) setPickerDismissed(false);
  break;
```

This re-shows the picker mid-session. If the list is empty the shortcut is a no-op.

---

### Step 9 -- Tests

**File**: `src/lib/workspaceHistory.test.ts` (new)

Cover:
- `addToRecents` moves an existing entry to the front (dedup)
- `addToRecents` caps at 8 entries
- `addToRecents` skips `C:\Program Files\Terax\` paths (case-insensitive)
- `addToRecents` skips `Program Files (x86)\Terax` paths
- `addToRecents` does not mutate the input array
- `addToRecents` handles empty list (first entry)

Run: `pnpm vitest run src/lib/workspaceHistory.test.ts`

---

### Step 10 -- Verify end-to-end

- [ ] `pnpm tauri dev`
- [ ] Navigate to 3 different project directories via the terminal
- [ ] Quit the app normally
- [ ] Relaunch -- picker appears, last workspace pre-selected; press Enter to restore
- [ ] Open the breadcrumb dropdown -- "Recent" section shows all entries
- [ ] Press `Ctrl+Shift+R` mid-session -- picker re-appears
- [ ] Press Escape -- picker dismisses, app stays on current workspace
- [ ] Force-kill the process; relaunch -- picker shows with no pre-selection
- [ ] Launch with `terax /some/path` -- picker is skipped entirely
- [ ] Navigate to a now-deleted directory path; relaunch -- stale path is filtered out
- [ ] `pnpm exec tsc --noEmit`  -- PASS
- [ ] `pnpm test`  -- PASS (101 tests, 8 files)
- [ ] `cd src-tauri && cargo clippy`
- [ ] `cd src-tauri && cargo test --locked`

---

## Estimated Complexity

Low-medium. No new Rust commands. 8 files change or are created:
- `store.ts` (additive)
- `launchDir.ts` (additive)
- `main.tsx` (2 lines)
- `App.tsx` (1 effect + picker render + shortcut case)
- `workspaceHistory.ts` (new, pure utility)
- `WorkspacePicker.tsx` (new component)
- `CwdBreadcrumb.tsx` (extend dropdown)
- `StatusBar.tsx` (pass prop)
- `shortcuts.ts` (additive)
- `workspaceHistory.test.ts` (new tests)

## Risk: beforeunload write timing

`LazyStore.save()` is async. On fast shutdowns (e.g. `taskkill`) the write may not
flush before the process exits, leaving `lastQuitClean === false`. This is acceptable
-- the picker simply shows with no pre-selection, which is the crash fallback behavior.
No data is lost; the `recentWorkspaces` list was already written on each `explorerRoot`
change (Step 4), which uses the 200 ms auto-save.
