# Driveby 2.2

A local-drive backup app with a macOS-style sidebar UI — **Tauri 2 + Rust** backend, **React 18 + Vite** frontend.

2.2 is a correctness / hygiene release on top of 2.1. The sync mode introduced in 2.1 had a handful of latent bugs around concurrency, exclude-pattern semantics, FAT/exFAT mtime handling, and dead code left over from the v2.0 hardlink-incremental flow. 2.2 fixes them and surfaces the accent picker that was wired up in CSS but never reachable from the UI.

## What's fixed in 2.2

| # | Area | Change |
|---|------|--------|
| 1 | **Concurrent runs** | `BackupState::try_register` is now atomic register-if-absent — a second `start_backup` for the same task while one is already running returns an error instead of silently racing two writers against the same destination tree. |
| 2 | **Exclude vs prune** | The mirror-delete pass now leaves alone any path matched by exclude patterns (basename or relative). Adding `node_modules` to excludes no longer wipes pre-existing `node_modules` folders out of the destination. `walk()` returns the set of excluded relative paths, which is forwarded to `prune_destination`. |
| 3 | **Source/dest overlap** | `execute()` rejects a task whose destination sits inside the source folder (or vice-versa) before any I/O — case-insensitive on Windows, with a canonicalisation pass. Eliminates the self-recursion / self-wipe edge cases. |
| 4 | **FAT/exFAT mtime tolerance** | `same_mtime` now accepts a 2-second window. FAT-family volumes round mtime to even seconds, so a perfect round-trip via `set_file_mtime` could land 1s off the source — every sync re-copied every file. With the tolerance, repeat syncs to USB/external drives are properly incremental. |
| 5 | **Restore points to a real path** *(documented)* | History entries continue to record `path = destination`, but see "Restore semantics" below — restore is documented as "this destination", not "this snapshot". The sync mode of 2.1+ doesn't write a manifest, so there is no separate snapshot folder to point at. |
| 6 | **Restore durability + I/O surfacing** | `restore::copy()` now `sync_all`'s before returning success and round-trips mtime. `restore::walk()` returns I/O errors instead of silently truncating iteration. A failed file mid-restore is also unlinked so a re-run isn't tricked by a half-written shell. |
| 7 | **`tasks.json` write-race** | A shared `persist::with_tasks_lock` Mutex now serialises every read-modify-write of `tasks.json` across `save_tasks` (JS-driven) and `update_last_backup` (Rust-driven). Scheduler-driven `lastBackup` writes can no longer clobber a user edit landing at the same instant. |
| 8 | **`continueOnError` actually continues** | A `create_dir_all` failure on one parent directory no longer aborts the whole backup. It bumps `failed_files`, records the error, and respects the `continueOnError` setting just like a copy failure does. |
| 9 | **Single-slice pies** | `CandleChart` now renders a full `<circle>` when a day has only one task. SVG arc paths degenerate when start/end map to the same point (a 100 % slice), so days with one task were drawing nothing. |
| 10 | **Stable keybindings** | `App.jsx` memoises its bindings array. The keydown listener no longer detaches and re-attaches on every render. |
| 11 | **`onSave` dead branch** | `NewTaskForm.submit` no longer guards on a return value its callers never produce — `onSave(task); return;` is what the code already meant. |
| 12 | **Half-written file after retries** | `copy_with_retries` now removes the destination after the *final* failure, not just before each attempt. Subsequent runs can't be tricked into "size matches, skip" on a corrupt remnant. |
| 13 | **No first-launch thundering-herd** | The scheduler treats a never-run scheduled task observed for the first time *in this process* as "started its clock now", instead of pretending it was last run at the Unix epoch. Cold start with five daily tasks no longer fires five backups 10 s after launch. |
| 14 | **Accent picker is reachable** | `AppContext` now sets `data-accent` from `settings.accentColor` (with a whitelist fallback to `DEFAULT_ACCENT`), and `Settings.jsx` exposes a 12-swatch picker under Appearance. |
| 15 | **No dangling confirm promises** | Opening a second `confirm` dialog while one is still pending now resolves the first promise to `false` before replacing it, instead of leaking a forever-pending promise. |
| 18 | **Destination root keeps its icon** | A source-root `desktop.ini` is no longer copied to the destination root, and an existing one already at the destination root is no longer prunable. The destination's own folder icon survives every sync, even when the source is a folder with a custom Explorer icon. Nested per-subfolder `desktop.ini` files still round-trip normally. |
| 19 | **Per-subfolder icons round-trip reliably** | The directory-attribute mirror loop now (a) ensures the destination subfolder exists before applying attributes — empty source folders are no longer skipped — (b) walks deepest-first so a parent's Readonly bit can't block a child's mutation, and (c) logs `SetFileAttributesW` failures via `tracing::warn` instead of swallowing them. Custom Explorer folder icons (Right-click → Properties → Customize → Change Icon) now reproduce in the destination. |
| — | **App icon refresh** | All `src-tauri/icons/*` (Windows `.ico`, macOS `.icns`, root `.png`, Windows-Store Square*, iOS AppIcon-* set, Android `ic_launcher*` set, master `source-1024.png`) regenerated from the new orange external-drive-with-down-arrow design. |
| 16 / 17 | **Dead code prune** | Removed: `Manifest`, `read_manifest` Tauri command + frontend wrapper, `incremental_from`, `MANIFEST_NAME`, `ERRORS_LOG`, `auto_cleanup_days` / `incremental` settings fields, the catch-all `_rest: serde_json::Value` flatten field, plus their JS-side `DEFAULT_SETTINGS` mirrors. The README's prior "hardlink incremental" / "manifest.json safety" claims are gone — 2.1+ is a flat sync, and 2.2 stops pretending otherwise. |

`lastBackup` is now only persisted on **successful** completion. Partial-failure runs no longer reset the schedule clock — a permanently-broken task stays visibly stale instead of silently retrying every interval forever.

## Restore semantics

The 2.1 sync mode writes no manifest. `entry.path` in History is the user-chosen destination root, and "Restore" copies the entire contents of that destination into a folder of the user's choice. If two tasks share a destination, restore returns the union. This is by design now — we don't pretend each backup is a discrete snapshot. If you want restorable per-run snapshots, use the 2.0 hardlink-incremental folder under `v2.0.0/`.

## Prerequisites / Running

```bash
cd v2.2.0
npm install
npm run tauri dev
npm run tauri build
```

## What's retained from 2.1

Motion system, Modify Task flow, reduced-motion fallback, single-instance / window-state / updater plugins, UI state persistence, xxHash3 verify, retries, continue-on-error, mtime preservation, tracing logs, Windows long-path (`\\?\`) handling, file `sync_all`, `desktop.ini` / Hidden / System / ReadOnly attribute mirroring.

## Open items for 2.3+

Parallel copies, platform-native fast copy (clonefile / copy_file_range / CopyFile2), streaming hash-during-copy, true per-run snapshots with restore-from-snapshot, history virtualization, responsive breakpoints, a11y + i18n pass.
