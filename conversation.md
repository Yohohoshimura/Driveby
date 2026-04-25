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

### 2.0 — sync rewrite, rebrand to Driveby, Statistics view, polish

This release pivoted the backup model and rebranded the app. Active folder is now `v2.0.0/`; all earlier folders were renamed `v1.0.1-beta` … `v1.7.0-beta` (plus the former `v1.8.0` which was promoted into this release). The repo folder itself was renamed `backup-drive` → `Driveby` (then reverted at end of session — see Session-end note).

**Rebrand**
- App name **BackupDrive → Driveby** everywhere user-facing: `package.json` (`"name": "driveby"`, `"version": "2.0.0"`), `Cargo.toml` (package + `[[bin]]` name `driveby`, version 2.0.0), `tauri.conf.json` (productName, identifier `com.driveby.app`, window title, longDescription), `index.html` `<title>`, `styles.css` header, `Sidebar.jsx` brand block ("Driveby — Version 2.0"), `NewTaskForm.jsx` schedule hint, `AppContext.jsx` notification title, `capabilities/default.json`, log filename `driveby.log`, startup `info!("Driveby 2.0 starting")`, root README + v2.0.0/README.

**Backup engine — major behavioral pivot (`backup.rs`)**
- **Sync into destination directly** — no `<name>_<timestamp>` wrapper folder, no `manifest.json` written. Files matching destination by size + mtime are skipped (`unchanged_files` counter).
- **Mirror-delete pass** — new `prune_destination(target, source_paths_set, token, &mut deleted)` walks dest, removes orphan files, then bottom-up removes now-empty directories. Emits a `phase: "pruning"` progress event. `cleaned` field of `CompletePayload` reports the count.
- **Windows custom folder icons preserved.** New Windows-only helpers `read_attrs(p)` / `apply_attrs(p, attrs)` using `windows-sys` (added as Cargo dep, target-cfg gated). Mask = `READONLY | HIDDEN | SYSTEM` only — never propagates ARCHIVE/REPARSE_POINT. `walk()` now returns `(files, dirs, total, skipped)` so directory paths can be rewalked at end. After every file copy → apply_attrs to dest. After prune → loop over `dirs` and apply_attrs to corresponding destination dirs. Without this, `desktop.ini` lost Hidden+System and parent folders lost the System bit, so Explorer ignored the icon descriptor.
- **Per-file progress no longer overshoots on retries.** `copy_with_retries` callback signature changed from delta-bytes to *cumulative-bytes-this-file*; on retry it calls `on_progress(0)` to reset. Caller maintains `base_bytes` snapshot per file. Without this, retried chunks accumulated and progress hit 100% while loop was still running ("stuck at 100%" symptom).
- **Forced final 100% emit** before completion (throttled `maybe_emit` could swallow the last update).
- **`lastBackup` always recorded on non-cancelled completion** (was `if payload.success` only). Timeout raised 5 s → 15 s. Long runs that hit a recoverable error still record their timestamp.
- **Tracing** `info!("emitting backup-complete")` for diagnosis.
- **Removed dead code** from the v1.7→v1.8 rewrite: `find_previous_backup`, `cleanup_old_backups`, `sanitize_name`, `sync_dir`, `VolumeId`, `volume_id`, the entire hardlink path, manifest writing, `errors.log` write, and unused imports (`DateTime`, `Regex`, `HashMap`, `debug`). Kept `MANIFEST_NAME`, `ERRORS_LOG`, `Manifest` for `restore.rs::read_manifest` backward-compat with v1.7 dated folders.
- `CompletePayload` field `hardlinked → unchanged`. AppContext history entry updated.
- Settings: removed `incremental` toggle from UI and "Maintenance" group (autoCleanupDays). The `incremental` field stays on the Rust struct for forward-compat with old `settings.json`. Accent color picker removed; data-accent locked to `'blue'` in AppContext (so previously-saved accent values are ignored).

**Statistics view (new top-level tab)**
- New `Statistics.jsx` route between History and Settings. Sidebar item with `BarChart3` icon. App.jsx routes + Ctrl+3 shortcut (Settings moved to Ctrl+4). TITLES updated.
- Three new chart components in `src/components/charts/`:
  - **`CandleChart.jsx` ("Backed Up")** — went through several iterations on user request: candle → bar → line → scatter → histogram → **stacked cumulative area chart** (final). x = run date `dd/mm`, y = cumulative bytes (auto-formatted via `formatBytes`), three stacked bands (cancelled/error/success bottom-up), accent line traces grand total, dot per run, legend below, horizontal scroll, auto-scrolls to latest. `chartHeight = 340`.
  - **`TaskList.jsx` ("Tasks")** — vertically scrollable list (max-height 240px) with name, source→destination, last-run time, schedule.
  - **`GroupedBarChart.jsx` ("Successful Runs")** — horizontally scrollable grouped vertical bars per task, success (accent) next to error (red). `BAR_W=28`, `GROUP_GAP=80`, `MIN_WIDTH=720` (expand horizontally per user). Y-axis ticks de-duplicated via `Set` so `maxCount=1` shows `0,1` not `0,1,1,1,1`. Gridlines positioned by tick value. Task names full (no `…` truncation), 11px.
- Old PieChart / ProcessCycle / Speedometer files left in `charts/` but no longer imported (tree-shaken). Stats section removed from `Home.jsx`.
- Statistics CSS in `styles.css`: `.stat-block`, `.candles*`, `.task-list-stat*`, `.grouped-bars*`, `.chart-empty`, `.legend-dot`, `.candles__legend`.

**Settings UI redesign**
- All `.setting-row__hint` description divs removed; replaced by an `i`-bubble tooltip on the left of each control.
- New `common/InfoTip.jsx` component with `placement` prop (`'left'` default, `'right'` for stacked rows). Renders a 16px circle with italic `i` glyph; `data-tip` attribute drives a CSS pseudo-element tooltip.
- Tooltip dialog: translucid frosted panel — `color-mix(bg-primary 78%, accent 12%)`, accent-tinted hairline border, `backdrop-filter: blur(20px)`, `label-primary` text. (Went through several iterations chasing "translucid" vs "blue enough" — landed back on the accent-mixed bg-primary version.)
- Info bubbles excluded from Appearance and Diagnostics rows on user request.
- `.setting-row__control { min-width: 72px; justify-content: flex-end; }` so all toggle+info pairs occupy the same right-aligned column block (16+10+36+padding = 72 px), giving symmetric alignment across General and Backup Options groups.
- Diagnostics button label "Open Logs…" → "Open".

**Other UI tweaks**
- TaskCard: removed `formatSpeed`/`formatDuration` imports + speed/ETA/dot-separators from the right-side stat line. Only `progress%` remains during a run. Primary action label flipped "Back Up" → "Start" → "Back up".
- Toast: `bg-window-solid` mixed with `transparent` (55%) + `backdrop-filter: blur(20px)` + softened hairline ring → translucent pill.
- `Sidebar.jsx`: NAV section name "App" → "Application".
- `Home.jsx`: New-task button label "+ New Task" → "New task".
- Autofill disabled on every text-entry surface — `autoComplete="off"` (+ `autoCorrect`/`autoCapitalize`/`spellCheck={false}` and unique `name`s on writable fields) on inputs in NewTaskForm (Name, Source, Destination), Sidebar search, History search, Settings (Default destination + Exclude patterns textarea).

**Versioning + cleanup**
- All older folders renamed with `-beta` suffix via `git mv` (or `mv` fallback): `v1.0.1` … `v1.7.0` → `v1.0.1-beta` … `v1.7.0-beta`. `v1.8.0` → `v2.0.0`.
- Repeated cleanup of build artifacts (`node_modules`, `src-tauri/target`, `src-tauri/gen`).
- Removed dead-code warning: `fn incremental` accessor deleted from `impl Settings`.

**Session-end housekeeping**
- The repo folder was renamed `backup-drive → Driveby` externally; we then attempted to undo it back to `backup-drive`. Inside the running session the rename failed (Windows refused — `Driveby` is the cwd of this Claude Code process). An empty `backup-drive` stub was cleaned up. The user must finish the rename from outside the session: `Rename-Item Driveby backup-drive` in PowerShell, plus rename the Claude project state dir `~/.claude/projects/C--Users-Yoshimura-Documents-Github-Driveby` → `…-backup-drive` so the JSONL transcript `e048a705-0e65-40a7-8cc1-450250038fc5.jsonl` keeps pairing.

## Key design decisions

- Tauri 2 desktop-only: dropped `[lib]` crate stanza (would be needed for mobile targets).
- Settings `confirmBeforeBackup`, `showNotifications`, `theme`, `accentColor` are UI-only; they round-trip through Rust's `Settings` struct via `#[serde(flatten)] _rest: Value` so the backend doesn't need to know about them.
- Drag-and-drop of folders into forms removed (Tauri webview doesn't expose absolute paths for dropped files the way Electron did). "Choose…" button replaces it.
- Scheduler stays in React — automatic runs require Driveby (formerly BackupDrive) to be open (same as 1.5).
- 2.0 sync model: source ↔ destination is a true mirror (copy + skip-if-same + delete-orphans). No timestamped wrappers, no manifest. Restore module still ships for legacy v1.7 dated backups.
- Windows attribute preservation is essential — without `READONLY | HIDDEN | SYSTEM` propagation, custom folder icons defined via `desktop.ini` silently break in the destination.
