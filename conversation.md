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

### 2.1 — motion + Modify Task

`v2.1.0/`. Built on top of 2.0's sync engine; surface-level work, no backend behavioural change.

- **Modify action.** `TaskCard` got a `Modify` button that disables while a backup is running and reuses `NewTaskForm` in edit mode. `Home.jsx` introduced an `editingId` state and an `useExitTransition`-backed mount/unmount so the form animates in/out cleanly. New `editTask(id, patch)` in `AppContext` writes through `bridge.saveTasks`; `lastEditingRef` keeps the form populated while it's animating away. Toast `"Task updated"`.
- **Motion system.** `cubic-bezier(0.32, 0.72, 0, 1)` easing throughout. Route cross-fade in `App.jsx` (`<div className="view-route" key={view}>`); staggered task list mount via `--stagger` CSS var; sidebar item pop + icon scale; animated progress bar with shimmer; button press-scale + hover lift; tooltip fade/scale; Statistics chart mount-in (area path fade, bars grow upward, list rows stagger). Durations 100–340 ms.
- **`prefers-reduced-motion`.** Single media-query block in `styles.css` collapses every animation/transition to ~0 ms.
- **Sidebar/version label.** "Driveby — Version 2.1".

### 2.2 — correctness pass + folder-icon round-trip + new app icon

Triggered by an audit request: "analyse v2.1.0 to find some flaws". The audit surfaced 17+ issues across the Rust backup engine, the React UI, and dead code from the v2.0 hardlink-incremental flow. v2.2.0 addresses every actionable item, plus a new app icon and a folder-icon-mirroring fix that came in as separate follow-ups.

**Concurrency / data-loss fixes (Rust):**
1. **Atomic concurrent-run guard.** `BackupState::register` (which blindly inserted into a `DashMap`) replaced by `try_register`, which uses `dashmap::Entry::Vacant` and returns `None` if a token already exists for that task. `run_backup` returns "A backup is already running for this task" instead of letting two `execute()` futures stomp the same destination.
2. **Exclude vs prune.** `walk()` now also returns `excluded: HashSet<String>` (relative paths matched by user patterns or by the new root-icon-marker rule). `prune_destination` accepts both that set *and* the patterns themselves and skips matching destination entries entirely. Adding `node_modules` to excludes no longer wipes a pre-existing `node_modules` from the destination.
3. **Source/destination overlap rejection.** New `path_contains(parent, child)` helper (case-insensitive on Windows, canonicalisation pass) called twice in `execute()` to reject self-syncs and any nested overlap before any I/O.
4. **2-second mtime tolerance.** `same_mtime` was strict whole-seconds equality, which meant exFAT/FAT destinations (which round to even seconds) re-copied every file every run. Now `(a.as_secs() - b.as_secs()).abs() <= 2`. Test added.
5. **Restore durability.** `restore::copy()` calls `sync_all`, preserves mtime via `filetime::set_file_mtime`, surfaces I/O errors from `walk()` (the v2.1.0 `while let Ok(Some(entry))` pattern silently truncated on failure), and unlinks half-written files on failure so a re-run isn't tricked by size-collision.
6. **`tasks.json` write-race.** New `persist::with_tasks_lock` (`tokio::sync::Mutex`) wraps every read-modify-write across both `save_tasks` (JS-driven) and `update_last_backup` (Rust-driven). `lastBackup` is now also only persisted on `payload.success`, not on any non-cancelled completion — partial-failure runs no longer reset the schedule clock.
7. **`continueOnError` honoured for `create_dir_all`.** Failure on a parent dir bumps `failed_files` and continues instead of `?`-propagating.
8. **Final-failure cleanup in `copy_with_retries`.** `fs::remove_file(long_path(dest))` runs before returning the final `Err` so a partial doesn't survive into the next sync.
9. **No-thundering-herd scheduler.** `scheduler::spawn` keeps a `Mutex<HashSet<String>>` of task IDs observed in this process. First observation of a `last_backup == None` task starts the clock at "now" instead of the Unix epoch, so a fresh install doesn't fire every daily task 10 s after launch.
10. **Destination root keeps its icon.** New `is_root_icon_marker(rel_str)` matches a top-level `desktop.ini` (case-insensitive, no `/` in the relative path); `walk()` adds it to `excluded` instead of the copy list, so it's neither propagated to the destination root nor pruned from there.
11. **Per-subfolder icons round-trip.** Three compounding bugs in the post-copy directory-attribute mirror loop: `SetFileAttributesW`'s BOOL return was ignored (now logged with `GetLastError`); empty source subfolders had no destination counterpart so `apply_attrs` silently no-op'd (now `fs::create_dir_all(long_path(&dest_dir))` runs first); iteration order was walk order so a parent's `+R` could block a child's mutation (now sorted deepest-first by `rel.len()`).

**JS / UI fixes:**
12. **Single-slice pies render as `<circle>`.** `arcPath(start=0, end=2π)` is degenerate (start point equals end point); `CandleChart.jsx` now branches on `day.slices.length === 1` and emits a full circle.
13. **Stable keybindings in `App.jsx`.** Wrapped the bindings array in `useMemo([], [])` so the `useKeyboard` effect doesn't re-attach the keydown listener every render.
14. **`NewTaskForm.submit` simplified.** The `if (ok !== false && !ok?.then) return; return;` on the edit branch was dead — `onSave` always returns synchronously. Now just `onSave(task); return;`.
15. **No dangling confirm promises.** `confirm()` previously dropped the prior `resolve` on the floor when called twice; it now calls `prev?.resolve(false)` inside the state updater before replacing it. `handleConfirm` does the same when settling.
16. **Accent picker removed entirely.** The CSS palette stays (12 swatches), but `Settings.jsx` only exposes Theme. `data-accent` is hardcoded to `DEFAULT_ACCENT` (`'blue'`) in `AppContext`. The original audit added a 12-swatch picker; the user then asked to remove it and lock to blue, so the picker UI was deleted but the underlying values kept for forward-compat.
17. **Dead-code prune.** Removed `Manifest`, `read_manifest` (Tauri command + `bridge.readManifest` wrapper), `incremental_from`, `MANIFEST_NAME`, `ERRORS_LOG`, `Settings._rest: serde_json::Value` (the `#[serde(flatten)]` field was unused and `Default::default()` on it produced an invalid map), `auto_cleanup_days`, `incremental` setting fields and their JS mirrors. README's "hardlink incremental / manifest.json safety" claims also gone.

**App icon refresh.** User supplied a flat orange external-drive-with-down-arrow JPG (`backup-drive-icon-vector_872227-104-1291922728.jpg`). PowerShell `System.Drawing` script in-session re-rendered it onto a 1024×1024 white-background PNG; `npx tauri icon ./src-tauri/icon-source.png` regenerated every variant (root `.png`/`.ico`/`.icns`, all `Square*` for Windows store, full iOS `AppIcon-*` set, all Android `ic_launcher*`, master `source-1024.png`). `tauri.conf.json`'s icon list was already pointing at these filenames, so no config change. Working `icon-source.png` deleted afterwards. Subsequent cleanup pass deleted `node_modules/` (114 MB), `src-tauri/target/` (3.1 GB), `src-tauri/gen/` (373 KB) — all .gitignored.

**Bug surfaced during dev:** initial `cp` of v2.1.0 → v2.2.0 dropped `useKeyboard.js`. Vite reported `Failed to resolve import "./hooks/useKeyboard"`. Restored the file from v2.1.0; no other follow-ups.

### 2.3 — EN/FR language switcher

`v2.3.0/`. Pure-JS i18n; no new dependencies.

- **`src/lib/i18n.js`** — flat key namespace, two locales (`en`, `fr`). `translate(lang, key, params)` does the `{name}` replace. `SUPPORTED_LANGUAGES`, `LANGUAGE_LABELS`, `DEFAULT_LANGUAGE` exported. Fallback chain: requested locale → `en` → key itself. No build-time codegen.
- **`src/hooks/useT.js`** — `useT()` returns a `useCallback`'d `t` bound to the current `settings.language`. Components do `const t = useT(); t('view.tasks')`. Inside `AppContext` itself the provider can't use the hook, so a local `tr()` helper reads from a `settingsRef` and calls `translate()` directly — that way async event listeners (the `backup-complete` toast in particular) always pick up the active language without re-binding.
- **Settings — Language section.** New segmented picker between Appearance and Diagnostics, two buttons (English / Français). Writes `language` via `updateSetting`, which round-trips through `bridge.saveSettings` and re-renders every consumer of `useT`.
- **Persistence.** `language: "en"` added to `default_settings()` in `src-tauri/src/main.rs` and `DEFAULT_SETTINGS` in `AppContext.jsx`. Validated against `SUPPORTED_LANGUAGES` at the read site so an unknown stored value falls back to `en` instead of crashing.
- **Translation coverage.** Every user-visible string in `App`, `Sidebar` (sections, items, search placeholder + aria, brand version, region aria), `Toolbar`, `Home`, `TaskCard` (last-run line interpolated, all four buttons + their aria-labels, schedule labels), `NewTaskForm` (every label/placeholder/option/error/dialog title), `Settings` (every section header, every label, every InfoTip, theme options, log button + toast), `History` (header, search, filter labels + `<select>` options, all column headers, status badges, all three row actions, empty state), `Statistics` (block headers, both chart `aria-label`s, the `<title>` tooltips inside `GroupedBarChart`, both empty states, legend), `ConfirmDialog` (Cancel + OK fallback). Brand "Driveby" intentionally untranslated.
- **Behavioural shape.** No re-mount when language changes — the picker just bumps `settings.language`, every `t()` consumer reads it, React re-renders. Sidebar item search filtering already operates on the localised label list because the `useMemo` depends on `t`.
- **Sidebar version label.** Bumped to "Version 2.3".

## Key design decisions

- Tauri 2 desktop-only: dropped `[lib]` crate stanza (would be needed for mobile targets).
- Settings `confirmBeforeBackup`, `showNotifications`, `theme`, `accentColor`, `language`, `sidebarOpen`, `lastView` are UI-only. They live in `settings.json` but the Rust `Settings` struct only deserialises the fields the engine actually needs — extras are ignored on the way in and round-tripped untouched on the way out via the JS-side full-object `bridge.saveSettings`. (The earlier `#[serde(flatten)] _rest: Value` field was deleted in 2.2 — `Default` on `Value` is `Null`, not a map, which made `Settings::default()` produce an invalid flatten field.)
- Drag-and-drop of folders into forms removed (Tauri webview doesn't expose absolute paths for dropped files the way Electron did). "Choose…" button replaces it.
- Scheduler stays in React — automatic runs require Driveby (formerly BackupDrive) to be open (same as 1.5).
- 2.0 sync model: source ↔ destination is a true mirror (copy + skip-if-same + delete-orphans). No timestamped wrappers, no manifest. Restore module still ships for legacy v1.7 dated backups.
- Windows attribute preservation is essential — without `READONLY | HIDDEN | SYSTEM` propagation, custom folder icons defined via `desktop.ini` silently break in the destination.
