# Tech Stack

## Runtime Architecture

Two-process Tauri 2 model:
- **Backend**: Rust process owns all OS access (PTY, fs, git, network, secrets)
- **Frontend**: React 19 webview communicates exclusively via `invoke()` IPC

## Backend (src-tauri/)

| Layer | Technology |
|---|---|
| App framework | Tauri 2 |
| Language | Rust (stable) |
| PTY | `portable-pty` (ConPTY on Windows, Unix PTY on macOS/Linux) |
| Git | `git2` + raw `git` subprocess |
| File search | `ignore` crate (respects .gitignore) |
| HTTP proxy | `reqwest` (async, via `ai_http_request` / `ai_http_stream`) |
| Secrets | `keyring` crate (OS keychain) |
| Serialization | `serde` / `serde_json` |
| Testing | `cargo test` + `cargo nextest` |
| Linting | `cargo clippy` (warnings are errors in CI) |

## Frontend (src/)

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript ~5.8 (strict) |
| Build | Vite 7 + `@vitejs/plugin-react` |
| Styling | Tailwind CSS v4 (`@theme` in App.css, no config file) |
| Components | shadcn/ui (`radix-luma` style, `mist` base, HugeIcons) |
| Terminal | xterm.js 6 with WebGL addon |
| Editor | CodeMirror 6 |
| AI SDK | Vercel AI SDK v6 (`ai` + `@ai-sdk/*`) |
| State | Zustand 5 |
| Animations | motion (Framer Motion v12) |
| Layout | react-resizable-panels |
| Virtualization | @tanstack/react-virtual |
| Testing | Vitest 2 |
| Path alias | `@/*` → `src/*` |

## Package Manager

`pnpm` — required. Never use npm, npx, or yarn.

## CI Pipeline

`.github/workflows/ci.yml` runs:
1. `pnpm exec tsc --noEmit`
2. `pnpm test`
3. `cd src-tauri && cargo clippy`
4. `cd src-tauri && cargo test --locked`

## Platform Targets

| Platform | Notes |
|---|---|
| macOS | `minimumSystemVersion: 10.15`, native traffic lights via `titleBarStyle: Overlay` |
| Linux | `decorations: false` + `transparent: true`, WebKit2GTK 4.1 |
| Windows | NSIS installer (no admin), WebView2 via embedBootstrapper, custom window controls |

## Key Constraints

- Bundle size target: ~7-8 MB. Every new dependency must justify its weight.
- No runtime telemetry.
- Secrets never touch disk, localStorage, or logs.
- All AI provider HTTP calls go through the Rust proxy (`net::*`), never from the webview.
