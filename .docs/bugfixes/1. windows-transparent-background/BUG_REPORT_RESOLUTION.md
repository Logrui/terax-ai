# Bug Fix: Windows Window Background Not Transparent

**Date**: 2026-06-02
**Status**: Resolved

## 1. Issue Description

- **Symptoms**: On Windows, the app window displayed rounded corners (from the custom CSS chrome) but the area outside the rounded rectangle -- which should show the desktop behind it -- was solid white instead of transparent. The window looked correct in shape but had a white background where the desktop should show through.
- **Context**: Windows 11, perMachine install. Reproducible on every launch. The issue did not affect macOS (which uses native traffic lights and a different chrome path).

## 2. Root Cause Analysis

- **Investigation**: Traced the rendering chain from the CSS (`html[data-chrome="borderless"]` sets `background: transparent` on `html`/`body`) through to the Tauri window configuration. The CSS was correct. The issue was at the WebView2 layer.
- **The Cause**: Two separate problems combined:
  1. `"transparent": true` was missing from the main window definition in `tauri.conf.json`. WebView2 requires this flag at **creation time** to allocate a transparent surface -- it cannot be changed after the window is created. Without it, WebView2 painted the entire window area white regardless of CSS.
  2. `decorations: false` was never set for the main window on Windows. The settings window had the correct pattern (`decorations(false).transparent(true)` in Rust via `#[cfg(any(target_os = "linux", target_os = "windows"))]`), but the main window was defined only in `tauri.conf.json` with no equivalent platform-specific override. `titleBarStyle: "Overlay"` and `hiddenTitle: true` in the config are macOS-only settings -- silently ignored on Windows.

## 3. The Fix

- **Changes Made**:
  - Modified `src-tauri/tauri.conf.json`: Added `"transparent": true` to the main window definition. This is safe on macOS because the CSS only applies `background: transparent` to `html`/`body` when `data-chrome="borderless"` is set, which only happens on non-Mac platforms.
  - Modified `src-tauri/src/lib.rs`: Added a `.setup()` callback that calls `window.set_decorations(false)` on the main window, gated to `#[cfg(any(target_os = "windows", target_os = "linux"))]`. macOS is excluded to preserve native traffic light buttons.

- **Code Snippets**:

`tauri.conf.json` -- main window entry:
```json
// Before
{
  "title": "Terax",
  "titleBarStyle": "Overlay",
  "hiddenTitle": true,
  "visible": false
}

// After
{
  "title": "Terax",
  "titleBarStyle": "Overlay",
  "hiddenTitle": true,
  "visible": false,
  "transparent": true
}
```

`src-tauri/src/lib.rs` -- setup callback added before `.manage()` calls:
```rust
.setup(|app| {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_decorations(false);
    }
    Ok(())
})
```

## 4. Verification

- **Test Case**: Build and install `Terax_Custom_0.7.3.exe`. Launch from Start Menu. Observe the window corners -- the area outside the rounded rectangle should show the desktop wallpaper/windows behind it, not a white rectangle.
- **Outcome**: Pending install test of current build. `cargo clippy` passes with no new warnings.
