# Spec: Inline image and binary file viewer

## Track ID
`image-viewer`

## Status
`planning`

## Problem

When a user opens an image file (PNG, JPG, JPEG, GIF, WEBP, SVG, ICO) or a PDF from the file explorer, the editor currently shows:

> Binary file
> `<size>` · preview not supported

There is no way to view these files inline. The only workaround is to open them in an external application.

## Goal

Render common binary file types inline inside the editor pane, without leaving the app, without adding significant bundle weight, and without introducing a new tab kind.

## In Scope

- **Raster images**: PNG, JPG/JPEG, GIF, WEBP, ICO
- **Vector images**: SVG
- **Animated images**: GIF (browser-native playback)

## Out of Scope (this track)

- PDF rendering (requires a heavy library or native WebView PDF; separate track)
- Video / audio files
- A new dedicated "viewer" tab kind (the editor tab reuses its binary detection path)

## User Stories

1. As a developer, when I click a PNG in the file explorer, I see the image rendered inside the editor tab, centered with a checkerboard background for transparency.
2. As a developer, the image viewer shows the filename, dimensions, and file size in a status strip.
3. As a developer, I can zoom in/out with standard scroll or keyboard shortcuts.
4. As a developer, SVG files render as images (not as editable XML) because they are detected as binary/image — but the user can switch to the text editor via a toggle button to edit the SVG source.
5. As a developer, the image tab title and icon match what an editor tab would show (file icon from the icon resolver).

## Non-Goals

- No image editing or annotation
- No fullscreen mode (the pane fills its panel; that is enough)
- No external library for image decoding — the browser WebView can decode all target formats natively

## Technical Approach

### Detection

`useDocument.ts` already detects `binary` status via `fs_read_file` returning `{ kind: "binary", size }`. We extend the detection: if the file extension is in the image set, return `{ kind: "image", dataUrl, size, width?, height? }` instead of plain `binary`.

Alternatively (lighter on IPC): keep the `binary` status, but in `EditorPane.tsx` check the extension and render `<ImagePane>` instead of the "Binary file" message. The image `src` is a Tauri asset protocol URL (`asset://localhost/<path>`) which Tauri already serves for local files — no base64 encoding needed.

### Asset Protocol

Tauri's `asset` protocol (`asset://localhost/<absolute-path>`) serves local files to the webview. It requires capability permission `"asset:default"` in `src-tauri/capabilities/default.json` with the relevant scope. This avoids reading the entire file into memory on the Rust side.

### Component

New component: `src/modules/editor/ImagePane.tsx`
- Renders `<img src={assetUrl} />` inside a scrollable, checkerboard-background container
- Shows filename, file size, and resolved image dimensions (via `onLoad`)
- Zoom: CSS `transform: scale()` driven by scroll + `+`/`-` shortcuts scoped to the pane
- SVG toggle: a button to switch between image render and text editor (opens a new editor tab for the same path pinned)

### Integration point

`EditorPane.tsx:284` — the `doc.status === "binary"` branch — add an `isImagePath(path)` guard to render `<ImagePane>` instead of the current message.

## Open Questions

- [ ] Does the `asset` protocol require scoping every file path, or is there a wildcard scope that covers workspace paths? (Check `src-tauri/capabilities/default.json` pattern.)
- [ ] Should the checkerboard background use a CSS pattern or a small inline SVG data URL?
- [ ] Should zoom state persist across tab switches (stored in tab state) or reset on each open?
