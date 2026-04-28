# BackupDrive 0.7 (beta)

A local-drive backup app with a macOS-style sidebar UI — **Tauri 2 + Rust** backend, **React 18 + Vite** frontend.

1.7 adds incremental backups, a restore flow, a background scheduler, per-backup manifests, verification, retries, continue-on-error, and UI-state persistence.

## What's new in 1.7

| Area | Change |
|------|--------|
| Incremental backups | Unchanged files are hard-linked from the previous successful backup (Time-Machine-style) — enormous disk and time savings. |
| Restore | One-click restore from History to any target folder. |
| Manifest | Each dated folder now contains `manifest.json` with source, destination, counts, bytes, duration, incremental base, exclude patterns, and verification status. |
| Verification | Optional xxHash3 verify pass of every file after copy. |
| Retries | Per-file retry (3×, exponential backoff) for transient errors like antivirus locks. |
| Continue-on-error | Optional: keep going on per-file failures, write `errors.log` in the backup folder. |
| mtime preservation | Destination files now carry the source's modification time (via the `filetime` crate). |
| Rust scheduler | Daily/weekly/monthly runs now trigger in a Rust background task — no longer dependent on the UI being open. |
| Cleanup | Uses the ISO timestamp in the folder name (not folder mtime), so OS/antivirus touches don't keep stale backups alive. |
| Plugins | `tauri-plugin-single-instance` (prevent double-launch races), `tauri-plugin-window-state` (remember size/position), `tauri-plugin-updater` (config-ready, disabled until a signing key is provided). |
| Logging | `tracing` rotating daily log files in the app log dir; "Open Logs…" in Settings → Diagnostics. |
| UI persistence | Sidebar open/closed and last-opened view are saved in settings and restored on launch. |
| Input chrome | Reset `border`/`outline`/`appearance` on all inputs — no more dark native border. |
| Opaque window | `transparent: false`; surfaces stay tinted with the active accent color via `color-mix`. |

## Prerequisites

- **Node** ≥ 18
- **Rust toolchain** (rustup, latest stable) — required for the Tauri 2 backend.
- Platform build tools:
  - macOS: Xcode Command Line Tools.
  - Windows: Microsoft C++ Build Tools + WebView2 (bundled on Win 11).
  - Linux: `webkit2gtk-4.1`, `libssl-dev`, `librsvg2-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`.

See <https://tauri.app/start/prerequisites/>.

## Getting started

```bash
cd v0.7.0-beta
npm install
npm run tauri dev           # dev
npm run tauri build         # installer
```

Icons can be regenerated from any source image:

```bash
npx @tauri-apps/cli icon src-tauri/icons/source-1024.png
```

## Project layout

```
v0.7.0-beta/
├─ src/                       # React frontend
│  ├─ App.jsx                 # persisted view + sidebar
│  ├─ components/
│  │  ├─ Sidebar.jsx, Toolbar.jsx
│  │  ├─ Home.jsx, TaskCard.jsx, NewTaskForm.jsx
│  │  ├─ History.jsx          # Restore / Reveal / Delete
│  │  ├─ Settings.jsx         # General · Backup Options · Filtering · Maintenance · Appearance · Diagnostics
│  │  ├─ charts/              # PieChart, ProcessCycle, Speedometer
│  │  └─ common/              # Button, Toggle, FormField, EmptyState
│  ├─ context/AppContext.jsx  # listen() once; settingsRef for fresh notifications
│  ├─ hooks/                  # useKeyboard, useSystemTheme (scheduler now in Rust)
│  └─ lib/                    # tauri.js adapter, format.js, accent.js
└─ src-tauri/
   ├─ Cargo.toml              # + filetime, xxhash-rust, tracing, single-instance, window-state, updater
   ├─ tauri.conf.json
   ├─ capabilities/default.json
   └─ src/
      ├─ main.rs              # plugins + 11 IPC commands + scheduler::spawn + tracing
      ├─ backup.rs            # hardlink incremental, verify, retries, mtime, manifest.json
      ├─ restore.rs           # read_manifest, restore()
      ├─ scheduler.rs         # background tokio task: polls tasks every 60s
      ├─ glob.rs              # *, **, ?, !neg
      └─ persist.rs           # atomic JSON read/write
```

## IPC surface

| Command | Notes |
|---------|-------|
| `get_settings`, `save_settings` | JSON roundtrip |
| `get_tasks`, `save_tasks` | JSON roundtrip |
| `get_history`, `save_history` | JSON roundtrip |
| `start_backup { task, settings }` | emits `backup-started`, `backup-progress`, `backup-complete` |
| `cancel_backup { taskId }` | cancels active run |
| `read_manifest { backupPath }` | reads `manifest.json` |
| `restore_backup { backupPath, destination }` | emits `restore-progress` |
| `reveal_logs_folder` | returns the log dir path |

## Keyboard

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + 1` | Tasks |
| `⌘/Ctrl + 2` | History |
| `⌘/Ctrl + 3` / `⌘/Ctrl + ,` | Settings |
| `⌘/Ctrl + S` | Toggle sidebar |
| `⌘/Ctrl + N` | New task (Tasks view) |
| `Esc` | Close form / dialog |

## Manifest shape

Stored as `manifest.json` inside every dated backup folder:

```json
{
  "version": "1.7.0",
  "taskId": "...",
  "taskName": "Documents — April",
  "source": "/Users/me/Documents",
  "destination": "/Volumes/Backup",
  "startedAt": "2026-04-24T12:00:00Z",
  "finishedAt": "2026-04-24T12:04:12Z",
  "durationMs": 252000,
  "totalFiles": 14382,
  "totalBytes": 12345678901,
  "copiedFiles": 412,
  "hardlinkedFiles": 13970,
  "failedFiles": 0,
  "skippedFiles": 0,
  "incrementalFrom": "/Volumes/Backup/Documents__April_2026-04-23T12-00-00",
  "excludePatterns": "*.tmp\nnode_modules",
  "verified": false
}
```

## Auto-update

`tauri-plugin-updater` is wired but the endpoint is disabled by default (`active: false`). To ship real updates:

1. Generate a key: `npx @tauri-apps/cli signer generate`
2. Put the public key in `tauri.conf.json` → `plugins.updater.pubkey`.
3. Host a `latest.json` at your `endpoints` URL.
4. Set `active: true`.

## Settings (additions)

- **Incremental backups** (default on): hard-link unchanged files.
- **Verify after copy** (default off): xxHash3 every file.
- **Continue on error** (default on): don't abort on per-file failures.
- **Preserve mtime** (default on): copy modification times.

## Notes vs 1.6

- Scheduler moved from React (`useScheduler`) to Rust (`scheduler::spawn`). Automatic backups now run even when the window is closed (app must still be running — this isn't a service).
- UI drops the `useScheduler` hook entirely.
- History entries store `hardlinked`, `failed`, and `verified` fields alongside the existing ones.
