# Plan: Inline image and binary file viewer

## Track ID
`image-viewer`

## Branch
`feat/image-viewer`

## Phase: Implementation

---

### Step 1 — Capability: enable asset protocol scope

**File**: `src-tauri/capabilities/default.json`

Add the `asset:default` permission with a scope that covers the user's home directory (or `**` wildcard if Tauri allows it). This grants the webview permission to load local files via `asset://localhost/<path>`.

Verify: load a known PNG via `asset://localhost/<absolute-path>` in the webview console; it must not 403.

---

### Step 2 — Utility: `isImagePath(path: string): boolean`

**File**: `src/modules/editor/lib/imageUtils.ts` (new)

```ts
const IMAGE_EXTS = new Set(["png","jpg","jpeg","gif","webp","svg","ico","bmp","avif"]);

export function isImagePath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTS.has(ext);
}

export function assetUrl(absolutePath: string): string {
  // Tauri asset protocol: forward-slash, percent-encode special chars
  const normalized = absolutePath.replace(/\\/g, "/");
  return `asset://localhost/${encodeURIComponent(normalized).replace(/%2F/g, "/")}`;
}
```

Add a Vitest unit test for both functions.

---

### Step 3 — Component: `ImagePane`

**File**: `src/modules/editor/ImagePane.tsx` (new)

Props:
```ts
type Props = {
  path: string;      // absolute path, used to build asset URL
  size: number;      // bytes, from useDocument
};
```

Behavior:
- Renders `<img src={assetUrl(path)} onLoad={handleLoad} />`
- `handleLoad` reads `naturalWidth` / `naturalHeight` from the event and stores in local state
- Container: `overflow-auto`, checkerboard CSS background (CSS `background-image` with two `linear-gradient` calls — no SVG, no external asset)
- Status strip at bottom: filename, `{w} x {h} px`, `formatBytes(size)`
- Zoom: `wheelZoom` handler (`e.ctrlKey && e.deltaY`) adjusts `scale` state (clamped 0.1–10); `+`/`-`/`0` keyboard shortcuts scoped via `onKeyDown` on the container (make it `tabIndex={0}`)
- SVG files: show a "View source" button that calls `openFileTab(path, true)` (passed as prop) — this opens a fresh editor tab with the SVG as text

---

### Step 4 — Wire into `EditorPane`

**File**: `src/modules/editor/EditorPane.tsx` (~line 284)

Replace:
```tsx
if (doc.status === "binary") {
  return (
    <div ...>
      <div>Binary file</div>
      <div>{formatBytes(doc.size)} · preview not supported</div>
    </div>
  );
}
```

With:
```tsx
if (doc.status === "binary") {
  if (isImagePath(path)) {
    return <ImagePane path={path} size={doc.size} onOpenSource={onOpenSource} />;
  }
  return (
    <div ...>
      <div>Binary file</div>
      <div>{formatBytes(doc.size)} · preview not supported</div>
    </div>
  );
}
```

`onOpenSource` is a new optional prop on `EditorPane` that `EditorStack` / `App.tsx` can wire to `openFileTab` — only needed for the SVG "View source" button.

---

### Step 5 — Export

**File**: `src/modules/editor/index.ts`

Export `ImagePane` and `isImagePath` from the barrel if needed by other modules.

---

### Step 6 — Test

**File**: `src/modules/editor/lib/imageUtils.test.ts` (new)

Cover:
- `isImagePath` returns true for all target extensions (case-insensitive)
- `isImagePath` returns false for `.ts`, `.rs`, `.md`
- `assetUrl` produces correct `asset://localhost/` prefix
- `assetUrl` normalizes Windows backslashes

---

### Step 7 — Verify end-to-end

1. Run `pnpm tauri dev`
2. Open a PNG from the explorer — image renders, status strip shows dimensions
3. Open a GIF — animates
4. Open an SVG — renders as image; "View source" opens it as text in a new tab
5. Open a `.wasm` or `.exe` — still shows "Binary file · preview not supported"
6. Run `pnpm exec tsc --noEmit`, `pnpm test`, `cargo clippy`, `cargo test --locked`

---

## Estimated Complexity

Low-medium. No new Rust code required if asset protocol scope is a config-only change. The heaviest part is getting the asset URL encoding right across platforms (Windows backslashes, spaces in paths).

## Risk: Asset protocol scope

If Tauri's asset protocol requires explicitly scoping each allowed directory and does not accept a wildcard, we may need to either:
- Scope to `$HOME/**` at capability time, or
- Fall back to having Rust read the file and return a base64 data URL via a new `fs_read_image` command (heavier IPC, but zero capability friction)

Investigate in Step 1 before writing any component code.
