# Product Guidelines

## Brand Identity

**Name**: Terax
**Tagline**: AI-native terminal emulator
**Bundle ID**: app.crynta.terax
**License**: Apache-2.0

## Design Philosophy

- **Premium and polished**: every state and interaction must feel considered. No placeholder UI, no skeleton-forever states.
- **Ultra-lightweight aesthetic**: the product is fast and small by identity. UI should feel instant; avoid heavy animations or large asset loads.
- **Terminal-native**: dark-first, monospace-comfortable, dense information layout. Users are comfortable in dense UIs.
- **Invisible chrome**: controls recede; content leads. Window decorations are custom and minimal.

## Visual Language

- **Typography**: Inter (UI) + JetBrains Mono (code/terminal). No other fonts.
- **Icons**: HugeIcons (stroke, not filled). Material/Catppuccin file icons in the explorer.
- **Component library**: shadcn/ui with `radix-luma` style and `mist` base. Never hand-edit primitives in `src/components/ui/` — regenerate via `pnpm dlx shadcn add`.
- **Theming**: CSS variable tokens via `@theme` in `App.css`. All color values reference variables; never hardcode hex in components. Built-in presets: terax-default, nord, tide, catppuccin, tokyo-night, caffeine, claude, gruvbox, sage, rose-pine.
- **Animations**: `motion` (Framer Motion successor). Subtle transitions only; nothing that delays perceived responsiveness.
- **Layout**: `react-resizable-panels` for all resizable splits.

## Writing Style (UI copy)

- Sentence case for labels and headings
- No em-dashes anywhere
- No emojis anywhere
- Terse and direct; no marketing speak inside the app
- Error messages must state what happened and (if actionable) what to do

## Code Style Enforced by TERAX.md

- No comments unless the why is non-obvious
- `@/` imports always (never relative across modules)
- `pnpm` only
- Functional core / imperative shell architecture
- No re-mounts on tab switch (visibility toggle, not unmount)
