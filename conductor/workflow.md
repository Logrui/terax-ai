# Workflow

## Branch Convention

- `main` — stable, always passes CI
- Feature branches: `feat/<track-id>` (e.g. `feat/image-viewer`)
- Bug fixes: `fix/<short-description>`
- No force-push to `main`

## Commit Convention

```
<type>(<scope>): <short summary>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
Scope: module name or `tauri` for Rust-side changes (e.g. `feat(editor)`, `fix(tauri/git)`)

No em-dashes. No emojis.

## Pre-Push Checklist

All four must pass before pushing:

```bash
pnpm exec tsc --noEmit
pnpm test
cd src-tauri && cargo clippy
cd src-tauri && cargo test --locked
```

This mirrors the CI pipeline exactly.

## Test Coverage Rules

- Any change to a **core subsystem** (terminal/shell spawn, workspace auth, git, fs, IPC, AI tool surface) requires a test that locks the invariant.
- Frontend utilities in `src/lib/` and `src/modules/*/lib/` should have Vitest unit tests.
- Rust modules in `src-tauri/src/modules/` use `cargo test` with `--lib` for unit tests and `tests/` for integration tests.
- Do not mock the IPC boundary in tests — test the pure logic underneath it.

## Track Phases

Each track in `conductor/tracks/<id>/` goes through these phases, verified before advancing:

| Phase | Exit criteria |
|---|---|
| **Spec** | `spec.md` written and reviewed; no open questions |
| **Plan** | `plan.md` written; implementation steps are unambiguous |
| **Implementation** | Code complete, all pre-push checks pass |
| **Verification** | Feature works end-to-end on macOS + Windows; no regressions in related modules |

## Architecture Rules (enforced per TERAX.md)

- **Functional core, imperative shell**: new logic lives in pure functions; Tauri commands and React components stay thin.
- **No re-mounts on tab switch**: tabs toggle `invisible pointer-events-none`, never unmount.
- **No relative cross-module imports**: always `@/modules/...`.
- **Rust IPC commands**: register in `lib.rs`, gate through workspace authorization if touching the filesystem.
- **Security**: apply the `lib/security.ts` deny-list on **both** read and write paths. Never bypass it.
