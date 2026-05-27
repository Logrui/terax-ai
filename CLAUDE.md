# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Terax** is a lightweight, open-source terminal emulator and AI-native development environment built with:
- **Backend:** Tauri 2, Rust, `portable-pty` (native PTY management)
- **Frontend:** React 19, TypeScript, xterm.js (WebGL rendering), CodeMirror 6
- **AI:** Vercel AI SDK v6 with multi-provider support (OpenAI, Anthropic, Google, Groq, xAI, Cerebras, DeepSeek, Ollama, LM Studio)
- **Target platforms:** macOS, Linux, Windows (with WSL support)
- **Package manager:** pnpm (required; never use npm/yarn)
- **Current version:** 0.7.3

The app is ~7-8 MB on disk with zero telemetry, no accounts, and BYOK (bring-your-own-keys) AI integration.

## Development Commands

### Prerequisites
- Rust (stable) from https://rustup.rs
- Node 20+ with pnpm: `npm install -g pnpm@latest`
- [Tauri platform prerequisites](https://tauri.app/start/prerequisites/) (platform-specific)

### Common Commands

```bash
# Development server with hot reload
pnpm tauri dev

# Production build
pnpm tauri build

# Frontend only (Vite preview)
pnpm dev              # dev server on port 1420
pnpm build            # frontend bundle (no Tauri)
pnpm preview          # preview built bundle

# Type checking
pnpm exec tsc --noEmit

# Tests
pnpm test             # frontend tests (vitest, run once)
pnpm test:watch       # frontend tests (watch mode)
cd src-tauri && cargo test --locked  # Rust tests

# Linting and quality
cd src-tauri && cargo clippy          # Rust linter (fails on warnings)
cd src-tauri && cargo fmt --check     # Rust formatter check
cd src-tauri && cargo fmt             # Auto-format Rust

# Coverage
cd src-tauri && cargo llvm-cov nextest --locked --lcov
```

### Running Single Tests

**Frontend (vitest):**
```bash
pnpm vitest run src/lib/shellQuote.test.ts
pnpm vitest run src/modules/ai/lib/security.test.ts
```

**Rust (cargo):**
```bash
cd src-tauri
cargo test fs::tree::tests --lib -- --nocapture
cargo test --test git_operations
cargo nextest run -k specific_test_name
```

### Pre-commit Checklist

Before pushing, verify all checks pass:
```bash
pnpm exec tsc --noEmit
pnpm test
cd src-tauri && cargo clippy
cd src-tauri && cargo test --locked
```

This matches the CI pipeline in `.github/workflows/ci.yml`.

## Architecture

Terax uses a **two-process model**: Rust backend owns all OS access (PTY, filesystem, git, network), and the React webview communicates exclusively via `invoke()` IPC calls.

### Backend (src-tauri/)

The Rust layer exposes Tauri commands in `src-tauri/src/lib.rs`:

**PTY Management (pty::*)**
- `pty_open`, `pty_write`, `pty_resize`, `pty_close`, `pty_close_all`
- Managed by `PtyState` (RwLock-protected HashMap)
- Output streams via Tauri channels; supports interactive long-lived sessions
- Windows uses ConPTY (Job Objects for cleanup), Unix uses `portable-pty`
- Shell integration via injected init scripts (OSC 7 for cwd, OSC 133 for prompt boundaries)

**Filesystem (fs::*)**
- `fs_read_dir`, `list_subdirs` (tree enumeration)
- `fs_read_file`, `fs_write_file`, `fs_stat`, `fs_canonicalize` (editor I/O)
- `fs_create_file`, `fs_create_dir`, `fs_rename`, `fs_delete` (mutations)
- `fs_search`, `fs_list_files` (fuzzy finder; powered by `ignore` crate)
- `fs_grep`, `fs_glob` (content search and glob patterns)
- `fs_watch_add`, `fs_watch_remove` (live filesystem watcher)

**Git (git::commands::*)**
- `git_status`, `git_diff`, `git_stage`, `git_unstage`, `git_commit`, `git_push`, `git_pull_ff_only`
- `git_log`, `git_show_commit` (history and inspection)
- `git_panel_snapshot`, `git_resolve_repo` (UI state)
- All commands are gated through workspace authorization registry

**Shell (shell::*)**
- `shell_run_command` — one-shot subshell execution for AI tools (distinct from interactive PTY)
- `shell_session_*` — persistent agent shell state
- `shell_bg_*` — background processes (dev servers) with ring-buffer log capture

**Network (net::*)**
- `ai_http_request`, `ai_http_stream` — HTTP proxy for AI providers
- Includes SSRF guard; keeps provider calls off the webview

**Secrets (secrets::*)**
- OS keychain via the `keyring` crate (Service: `"terax-ai"`)
- Platform: native (Windows native, macOS Keychain, Linux file-based fallback)
- Keys never touch disk/localStorage

**Workspace (workspace::*)**
- `workspace_authorize`, `workspace_current_dir` — path authorization registry for spawn/git/AI
- `wsl_list_distros`, `wsl_default_distro` — WSL workspace bridge

**Other**
- `open_settings_window` — spawns separate settings webview with optional tab deep-link

Key Rust modules in `src-tauri/src/modules/`:
- `pty/` — shell integration scripts (platform-specific init)
- `fs/` — file tree, search, grep, mutations, watchers
- `git/` — git command wrappers and diff parsing
- `shell/` — process spawning, background tasks
- `agent.rs` — AI tool handling and approvals
- `workspace.rs` — authorization registry and WSL bridge
- `net.rs` — HTTP proxy and security checks
- `secrets.rs` — keychain interface


### Frontend (src/)

Single-window React app with path alias @/* -> src/*.

**App structure (src/app/App.tsx - 1608 lines):**
- Main layout coordinator using resizable panels
- Wires all module components (terminal, editor, explorer, etc.)
- Manages global shortcuts, theme, window state
- Handles AI input bar, chat panel, and approval dialogs
- Tabs are hidden on switch (not unmounted) so PTYs/dev servers stream continuously

**Module layout (src/modules/):**
Each module is self-contained with a barrel export (index.ts) and owns its hooks/logic under lib/:

- **terminal/** - xterm.js integration via TerminalStack, PTY stream bridge, OSC handler (cwd + prompt boundaries)
- **editor/** - CodeMirror 6 stack, language modes, theme integration, vim mode
- **explorer/** - file tree with Material/Catppuccin icons, fuzzy search, keyboard nav, inline rename
- **preview/** - auto-detected dev-server tabs, image/PDF viewer, sandboxed iframe
- **tabs/** - useTabs (source of truth), useWorkspaceCwd, per-tab environment
- **header/** - top bar, inline search (adapts to terminal/editor), window controls
- **statusbar/** - bottom bar, cwd breadcrumb (handles /, \, WSL, home ~), agent indicator
- **source-control/** - git status/stage/commit panel, diff workflow
- **git-history/** - commit graph rail, refs, per-commit diffs
- **sidebar/** - activity bar, collapsible panels
- **theme/** - custom theme engine (CSS variables), built-in presets, background images
- **settings/** - settings store (tauri-plugin-store), preferences, window opener
- **workspace/** - environment switching (Local, WSL distros)
- **shortcuts/** - keymap registry, global handlers
- **markdown/** - markdown preview (backs markdown tab kind)
- **ai/** - see below

**Tabs union type:**
Tabs have a `kind` discriminant: terminal | editor | preview | markdown | ai-diff | git-diff | git-history | git-commit-file. Switching tabs toggles visibility (not unmounting) to keep background streams alive.

### AI Subsystem (src/modules/ai/)

BYOK (bring-your-own-keys) multi-provider integration using Vercel AI SDK v6.

**Providers:**
- **Cloud:** OpenAI, Anthropic, Google Gemini, xAI (Grok), Cerebras, Groq, DeepSeek, Mistral, OpenRouter
- **Local/Offline:** LM Studio, MLX, Ollama (key-optional)
- **Custom:** any OpenAI-compatible base URL

**Key flows:**
- lib/agent.ts (461 lines) - main agent orchestration, tools (file ops, bash, search), plan mode
- lib/agents.ts - agent registry and selection
- store/chatStore.ts - conversation state, message history, streaming
- store/agentsStore.ts - custom agent definitions and settings
- components/AiChat.tsx - main chat UI
- components/AiInputBar.tsx - composer with file/snippet pickers, voice input, slash commands
- components/AiMiniWindow.tsx - draggable/resizable mini window for floating chat

**Agent tools (in agent.ts):**
- File ops: file_read, file_write, file_edit, file_multi_edit, file_create
- Search: fs_search (fuzzy), fs_grep (regex), fs_glob (patterns)
- Bash: shell_run_command with approval gating
- Plan mode: generates multi-step plans, requires confirmation before execution

**Security model:**
- OS keychain for API keys (never persisted to localStorage/disk)
- SSRF guard in net.rs (IP allowlist, no private networks)
- Tool approval flow for file writes and bash execution
- redact function sanitizes sensitive info from context
- Secret-path deny-list applies on both read and write

**Agent notifications (src/modules/agents/):**
Terminal agent detection via OSC 133 (prompt markers) on PTY reader. Emits terax:agent-signal transitions (started/working/attention/finished) for Claude Code and other terminal agents. Zero cost when no agent runs.

## Code Patterns and Conventions

**From TERAX.md (mandatory):**
- No em-dashes or emojis anywhere
- Default to no comments; 1-2 lines only on *why*, never *what*
- Imports: always @/... on frontend, never relative across modules
- **pnpm only** - never npm/npx/yarn
- Verify quality bar: pnpm exec tsc --noEmit, pnpm test, cargo clippy, cargo test --locked

**Architecture principles:**
- **Functional core, imperative shell:** Pure utility functions in lib/, thin Tauri commands and React components
- **Avoid re-mounts:** AiComposerProvider mounted unconditionally at App root (conditional wrapper would remount the entire tree when keys load, killing all PTYs)
- **Hidden over unmounted:** Tabs switch via invisible pointer-events-none, not unmounting, so PTYs stream in background
- **Performance-conscious:** Every change should justify its RAM cost, IPC round-trips, re-renders, and dependency weight

**Testing strategy:**
- Frontend: vitest with focus on edge cases (security, geometry, parsing)
- Rust: cargo nextest, property-based testing with proptest, platform-specific tests for pty/shell
- Integration tests in src-tauri/tests/ for fs, git, shell, background processes

**Workspace authorization:**
Path accesses (spawn, git, file ops) go through WorkspaceRegistry in src-tauri/src/modules/workspace.rs. New operations that touch the FS or run commands must call registry.authorize(path).


## Key Files and Their Purposes

**Frontend entry:**
- src/main.tsx - app bootstrap, window show timing, PTY reap
- src/app/App.tsx - layout coordinator, module wiring, shortcuts, state bridges
- src/vite-env.d.ts - Vite type declarations

**Backend entry:**
- src-tauri/src/lib.rs (191 lines) - Tauri command handler registry, plugin setup, app initialization
- src-tauri/src/main.rs - binary entry (thin wrapper)

**Configuration:**
- vite.config.ts - Vite + Tailwind, chunk splitting (lazy-loaded AI provider SDKs, xterm, CodeMirror, motion)
- tsconfig.json - TypeScript strict mode, ES2020 target, path aliases
- src-tauri/Cargo.toml - Rust dependencies, platform-specific features
- pnpm-workspace.yaml - workspace config (currently single root)
- tauri.conf.json - Tauri app config (bundle ID, icons, plugins)

**Documentation:**
- TERAX.md - living architecture doc (required reading before changes)
- ROADMAP.md - direction, themes, shipped features, planned work
- CONTRIBUTING.md - contribution guidelines, quality bar, discussion protocol

**Tests:**
- src/**/*.test.ts - frontend unit tests (vitest)
- src-tauri/tests/ - Rust integration tests (fs_search, git_operations, shell_background)

## Common Development Scenarios

### Adding a New AI Tool
1. Define tool schema in src/modules/ai/lib/agent.ts (tools array)
2. Add handler in toolHandlers map (same file)
3. Export new handler from agents/index.ts if cross-module
4. Add tests in src/modules/ai/ and Rust side if it touches agent.rs

### Adding a New Editor Language
1. Add CodeMirror language import in src/modules/editor/extensions.ts
2. Update file-type detection in language registry
3. Test syntax highlighting with sample files

### Fixing a Git Command
1. Edit corresponding function in src-tauri/src/modules/git/commands.rs
2. Add integration test in src-tauri/tests/git_operations.rs
3. Test in dev mode: pnpm tauri dev and trigger the action in UI

### Adding a Settings Option
1. Define property in src/modules/settings/store.ts (using tauri-plugin-store)
2. Create settings panel UI in src/settings/ (separate webview)
3. Bind via usePreferencesStore hook in feature modules
4. Apply theme/behavior changes in theme provider or feature components

### Shell Integration Debugging
1. Check init scripts in src-tauri/src/modules/pty/scripts/ (platform-specific)
2. Verify OSC emission: look for OSC 7 (cwd) and OSC 133 (prompt markers) in terminal output
3. Test with echo -e "\033]7;file://..."; the header should reflect cwd change
4. Windows cwd normalization: check src-tauri/src/modules/pty/osc_handlers.rs for /C:/ -> C:/ conversion

## Git Workflow

- **Main branch:** main (production, always stable)
- **Feature branches:** create from main, open PR, discuss before large features
- **Naming:** descriptive, e.g. fix/terminal-paste-multiline, feat/ssh-support
- **Commits:** clear messages, reference issues; follow conventional commit style when possible
- **Pre-push:** run pnpm exec tsc --noEmit && pnpm test && cd src-tauri && cargo clippy && cargo test --locked

## Tauri IPC and Type Safety

Frontend calls Rust via invoke(command, args):
```typescript
import { invoke } from "@tauri-apps/api/core";
await invoke("pty_write", { sessionId: "xyz", data: "ls\n" });
```

All commands are registered in src-tauri/src/lib.rs via #[tauri::command] and listed in generate_handler![]. The Rust function signature defines the IPC contract; frontend TypeScript should mirror it (using any for untyped args is acceptable for complex payloads, but prefer structured types).

## Performance Notes

1. **Terminal rendering:** xterm.js with WebGL renderer; avoid heavy re-renders of terminal stack
2. **File explorer:** uses ignore crate to respect .gitignore; fuzzy search is O(n log n), acceptable for 10k+ files
3. **Git diff:** lazy-loaded, only computed when tab is visible
4. **AI streaming:** via Tauri channels; don't parse entire response at once
5. **Bundle size:** aggressive chunk splitting for AI provider SDKs (they're lazy-imported). Monitor new dependencies with pnpm ls | grep "^" | wc -l

## Debugging Tips

1. **Rust panics:** check tauri-plugin-log output in ~/.local/share/terax/logs/ (or platform equivalent)
2. **Frontend DevTools:** Cmd+Option+I (macOS) / Ctrl+Shift+I (Windows/Linux) in dev mode
3. **IPC tracing:** add console.log around invoke() calls to see args/results
4. **PTY issues:** check OSC sequences with cat -v or xterm's showcontrol; verify shell init scripts are loaded
5. **Git issues:** test git commands directly in the workspace; check git config --list

## When to Reach Out

- **Direction questions:** open a GitHub Issue or ask in Crynta OS Discord (https://discord.gg/tyveTUyEp7)
- **Unsure if contribution fits:** discuss first (see CONTRIBUTING.md); PRs with unaligned scope will be closed
- **Complex refactors:** align with maintainer before starting; solo project with strong opinions

---

**Last updated:** Terax v0.7.3 | For latest arch guidance, see TERAX.md and ROADMAP.md

