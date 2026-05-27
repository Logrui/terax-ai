# Product Guide

## What is Terax?

Terax is an open-source, AI-native terminal emulator and lightweight development environment. It is a single desktop app (~7-8 MB) that combines a full PTY terminal, a code editor, a file explorer, source control, and a BYOK AI assistant with tool use — all with zero telemetry, no accounts, and no cloud lock-in.

## Users

**Primary**: solo developers and power users who live in the terminal and want an AI assistant that can read/write their files and run commands, without surrendering their API keys to a third party.

**Secondary**: teams evaluating lightweight, self-hostable alternatives to cloud IDE products.

## Core Goals

1. **Terminal-first**: the terminal is the primary surface, not an afterthought. PTY fidelity, shell integration (OSC 7/133), and performance are non-negotiable.
2. **AI with full context**: the AI agent can see the file tree, read files, run commands, and propose code diffs — gated by explicit user approval for mutations.
3. **Ultra-lightweight**: the bundle must stay ~7-8 MB. Every dependency is a trade-off against this constraint.
4. **Privacy by design**: API keys live in the OS keychain, never on disk or in logs. SSRF guard on all outbound AI calls.
5. **Cross-platform**: macOS, Linux, and Windows (including WSL workspaces) are all first-class targets.

## Key Features (current, v0.7.3)

- Multi-tab PTY terminal with xterm.js WebGL rendering
- CodeMirror 6 editor with vim mode, 8+ themes, and AI autocomplete
- File explorer with Material/Catppuccin icons, fuzzy search, inline rename
- Source control panel (git status, stage, commit, push/pull, diff viewer)
- Git history with commit graph rail
- BYOK AI: OpenAI, Anthropic, Google, xAI, Cerebras, Groq, DeepSeek, Ollama, LM Studio, OpenRouter, custom OpenAI-compatible
- AI tool use: read/write files, run commands, search, sub-agents
- Background process management (dev servers with ring-buffer logs)
- Custom theme engine with CSS variable tokens + background images
- Auto-updater, macOS/Linux/Windows window chrome

## Known Gaps (potential tracks)

- No inline viewer for binary files (images, PDFs)
- No plugin/extension system
- No notebook or REPL surface
- No multi-window / detached tab support
