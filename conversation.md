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

**Rust backend (`v1.6.0/src-tauri/`):**
- `main.rs` — Tauri 2 Builder, 8 IPC commands.
- `backup.rs` — tokio-based copy engine, `CancellationToken` cancellation via `tokio::select!`, per-file throttled progress emit, safe timestamped folders, regex-guarded cleanup.
- `glob.rs` — `*`, `**`, `?`, `!neg` with comma/newline separators + tests.
- `persist.rs` — atomic JSON read/write (tmp + rename).
- `DashMap` for concurrent active-backup tracking, `uuid v4` IDs, `serde` camelCase payloads.

**React frontend (`v1.6.0/src/`):**
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

### 1.7 — reliability + incremental + restore
Built on the 1.7 audit — implemented the "big wins" block.

**Backend**
- `backup.rs`: manifest.json per dated folder; hardlink-based incremental (size+mtime match against the previous successful backup); xxHash3 verify pass; retry with exponential backoff (3×); continue-on-error (collect failures into `errors.log` and fail only if policy requires); mtime preservation via `filetime`; adaptive copy buffer (256 KB < 4 MiB < 1 MiB); cleanup parses the ISO timestamp from folder names instead of using folder mtime.
- `restore.rs`: `read_manifest` + `restore(backup_path, destination)` with `restore-progress` events.
- `scheduler.rs`: background tokio task polling tasks.json every 60 s; fires due daily/weekly/monthly tasks even when the window is closed; writes back `lastBackup` atomically.
- `main.rs`: new plugins — `tauri-plugin-single-instance`, `tauri-plugin-window-state`, `tauri-plugin-updater` (config stub); `tracing` + `tracing-appender` rotating daily log files in `app_log_dir`; new commands `read_manifest`, `restore_backup`, `reveal_logs_folder`.

**Frontend**
- Dropped `useScheduler` (now in Rust).
- `AppContext`: listener subscribes once; notification logic pulled from a `settingsRef`; new `restoreBackup` helper prompts for destination and confirms.
- `History`: **Restore** button (for successful entries) alongside Reveal/Delete.
- `Settings`: new **Backup Options** group (Incremental / Verify / Continue on error / Preserve mtime) and a **Diagnostics** group with "Open Logs…".
- `App.jsx`: persists `sidebarOpen` and `lastView` to settings; restores on launch.
- New settings: `incremental`, `verify`, `continueOnError`, `preserveMtime`, `sidebarOpen`, `lastView`.

### 1.8 — correctness pass
Built on the 1.7 audit — shipped the **Critical** block only.

- **`lastBackup` race fixed.** Ownership moved into Rust (`backup::update_last_backup`). Rust writes `tasks.json` atomically + emits `task-updated`. Scheduler no longer rewrites the file. UI drops its auto-save effect and persists `tasks.json` only on user actions (add/edit/delete). UI listens for `task-updated` and reconciles without re-saving.
- **Incremental base validation.** Previous-backup selection now requires `manifest.json` to parse and `failed_files == 0`. Partial/corrupt folders are skipped.
- **Cross-volume hardlink guard.** `volume_id()` helper (Unix `MetadataExt::dev`, Windows `MetadataExt::volume_serial_number`). Mismatch short-circuits the hardlink path — no wasted per-file attempts.
- **Windows long paths.** `long_path()` helper prefixes `\\?\` (or `\\?\UNC\`) for absolute paths; used at every fs call site.
- **Durability.** `writer.sync_all()` after flush on every copy; manifest `sync_all`; Unix directory fsync at end of run.
- **Scheduler simplified.** Removed the post-completion `tasks.json` rewrite block — `run_backup` handles it.

**New event:** `task-updated` (Task JSON). **New bridge method:** `onTaskUpdated(cb)`.

## Key design decisions

- Tauri 2 desktop-only: dropped `[lib]` crate stanza (would be needed for mobile targets).
- Settings `confirmBeforeBackup`, `showNotifications`, `theme`, `accentColor` are UI-only; they round-trip through Rust's `Settings` struct via `#[serde(flatten)] _rest: Value` so the backend doesn't need to know about them.
- Drag-and-drop of folders into forms removed (Tauri webview doesn't expose absolute paths for dropped files the way Electron did). "Choose…" button replaces it.
- Scheduler stays in React — automatic runs require BackupDrive to be open (same as 1.5).
