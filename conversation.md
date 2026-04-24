# BackupDrive — Conversation Log

A compressed record of the decisions and changes made across this project's evolution from 1.0.1 to 1.6. Full raw transcript lives in the local Claude Code project log.

## Timeline

### 1.0.1 – 1.4 (existing)
Sequence of standalone Electron + React builds, each iterating on UX.

### 1.5 — Electron, corrections pass
- Deep audit of 1.4 → `claude_report.md` at repo root (23+ items: correctness, security, arch, UX).
- Rewrote all of 1.5 addressing every audit item.
- Reworked UI with macOS (Apple HIG) style inspired by [macos_ui](https://github.com/macosui/macos_ui): SF Pro fonts, 8 system accent colors, 0.5px hairlines, green toggles, light/dark/system mode.
- Removed unused `@fontsource` packages after switching to native Apple fonts.

### 1.6 — Tauri + Rust rewrite
Full port: React UI kept, Electron `main.js` replaced by Rust backend. ~10× smaller installer, lower memory, safer fs ops.

**Rust backend (`1.6/src-tauri/`):**
- `main.rs` — Tauri 2 Builder, 8 IPC commands.
- `backup.rs` — tokio-based copy engine, `CancellationToken` cancellation via `tokio::select!`, per-file throttled progress emit, safe timestamped folders, regex-guarded cleanup.
- `glob.rs` — `*`, `**`, `?`, `!neg` with comma/newline separators + tests.
- `persist.rs` — atomic JSON read/write (tmp + rename).
- `DashMap` for concurrent active-backup tracking, `uuid v4` IDs, `serde` camelCase payloads.

**React frontend (`1.6/src/`):**
- New sidebar layout (search + icon nav groups + brand footer), inspired by macos_ui screenshot.
- `App.jsx`, `Sidebar.jsx`, `Toolbar.jsx` (sidebar toggle + title).
- Ported 1.5 components to `.jsx`: Home, TaskCard, NewTaskForm, History, Settings, ConfirmDialog, Toast, common/*.
- `lib/tauri.js` adapter — replaces `window.electron` with `invoke` / `listen` / plugin-dialog / plugin-opener / plugin-notification.
- `context/AppContext.jsx` adapted for async `listen()` (Promise<UnlistenFn>).
- `EmptyState` default text is just **"Empty"** per user request.
- Scheduler still in React layer (daily/weekly/monthly triggers).

### Post-1.6 tweaks

**Build fixes**
- Removed erroneous `[lib]` stanza from `Cargo.toml` (no `lib.rs`).
- Generated placeholder 1024×1024 icon via PowerShell, then ran `npx @tauri-apps/cli icon` to produce full icon set.

**Scroll fix**
- Classic flexbox overflow bug: `.content` (flex child with `overflow-y: auto`) wouldn't scroll. Added `min-height: 0` to `.main`, `.content`, `.sidebar__nav`. Wrapped content in `.content__inner` for max-width column while keeping full-width scrollbar.

**Stat visualizations**
- Replaced 3 stat bubbles on Home with SVG charts:
  1. **PieChart** — donut of success/error/cancelled bytes; center shows formatted total, shows `0` (not `0 B`) when empty, no "Saved" inner label.
  2. **ProcessCycle** — accent-colored ring with arrow + one dot per task, count in center.
  3. **Speedometer** — half-circle gauge. Needle fixed at 90° (center). Left half translucent red (intensity reflects failures), right half translucent green (intensity reflects successes). No inner text.

**Translucency + accent tint**
- Surface opacities bumped ~0.7 → ~0.92.
- All translucent surfaces tinted with active accent via `color-mix(in srgb, var(--accent) N%, …)` — tint updates live with accent change.

**Accents + naming**
- Added 4 accents: **Indigo, Mint, Teal, Brown** (total 12: Blue, Indigo, Purple, Pink, Red, Orange, Yellow, Green, Mint, Teal, Brown, Graphite).
- Renamed **Preferences → Settings** in sidebar nav and toolbar title.

**Repo hygiene**
- Added repo-root `.gitignore` covering `node_modules/`, `**/target/`, `dist/`, `src-tauri/gen/`, env files, OS/editor junk.

## Key design decisions

- Tauri 2 desktop-only: dropped `[lib]` crate stanza (would be needed for mobile targets).
- Settings `confirmBeforeBackup`, `showNotifications`, `theme`, `accentColor` are UI-only; they round-trip through Rust's `Settings` struct via `#[serde(flatten)] _rest: Value` so the backend doesn't need to know about them.
- Drag-and-drop of folders into forms removed (Tauri webview doesn't expose absolute paths for dropped files the way Electron did). "Choose…" button replaces it.
- Scheduler stays in React — automatic runs require BackupDrive to be open (same as 1.5).
