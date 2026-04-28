# Driveby 1.0

A local-drive backup app with a macOS-style sidebar UI — **Tauri 2 + Rust** backend, **React 18 + Vite** frontend.

1.0 is the first stable release. All previous versions (`v0.0.1-beta` through `v0.7.0-beta`) are retained as **beta** snapshots in their own folders. The pre-release that previously carried a `v1.8.0` tag — a correctness pass on top of `v0.7.0` — was folded into this 1.0 release rather than getting its own folder. The app was previously called **BackupDrive**.

## What's new in the merged correctness pass (formerly 1.8)

| Area | Change |
|------|--------|
| `lastBackup` ownership | Rust now owns `lastBackup` and emits a `task-updated` event. The UI subscribes, drops its auto-save effect, and only persists `tasks.json` on explicit user actions (add/edit/delete). The scheduler ↔ UI race is gone. |
| Incremental base safety | A previous backup is only selected as an incremental base if it has a readable `manifest.json` **and** `failed_files == 0`. Crashed or partially failed runs never contaminate a new incremental. |
| Cross-volume hardlink guard | The destination's volume/device id is compared against the previous backup's before attempting any hard link. Cross-volume incremental attempts fall back to a full copy automatically instead of silently wasting per-file hardlink calls. |
| Windows long path (`\\?\`) | All file operations route through a `long_path()` helper that prefixes absolute paths with `\\?\` (or `\\?\UNC\` for network paths) on Windows. Paths > 260 characters now work in source and destination trees. |
| Durability (`fsync`) | Every copied file is `sync_all`'d after flush. Manifest files are fsync'd. On Unix, the backup directory is fsync'd. A power loss during copy can no longer leave a file "looks done" but actually short. |
| Scheduler | No longer writes `tasks.json` itself — centralized in `backup.rs::update_last_backup`. Simpler, race-free. |

All 0.7 features (hardlink incremental, restore, xxHash3 verify, retries, continue-on-error, mtime preservation, tracing logs, single-instance / window-state / updater plugins, UI state persistence) are retained.

## Prerequisites / Running / Icons

Same as 0.7 — see the 0.7 README, or:

```bash
cd v1.0.0
npm install
npm run tauri dev
npm run tauri build
```

## New / updated surfaces

**New event:** `task-updated` — payload is the full Task JSON after `lastBackup` has been bumped.

**Adapter additions (`src/lib/tauri.js`):** `onTaskUpdated(cb)`.

**Removed from frontend:** the `useEffect(() => bridge.saveTasks(tasks), [tasks, loaded])` auto-save. `tasks.json` is now written only from:
- Rust (`update_last_backup` after a successful run).
- UI's explicit `addTask`, `editTask`, `deleteTask`.

## Testing the fixes

| Fix | How to check |
|-----|--------------|
| `lastBackup` race | Schedule a backup, close the window with the task list open on another machine / session. On reopen, last run time reflects the scheduler run without requiring UI re-save. |
| Incremental safety | Corrupt or delete a previous backup's `manifest.json`; the next run should pick the *prior* valid one (or none). |
| Cross-volume | Point `destination` at a different drive than the previous backup — hardlink count should drop to 0 and full copy kicks in. |
| Long paths | Source a deeply nested folder whose longest path exceeds 260 chars on Windows. |
| fsync | Pull power mid-copy; the partial destination file's size equals what was actually synced at the last block boundary, never past. |

## Open items for 1.1+

Tracked in the internal audit: parallel copies, platform-native fast copy (clonefile / copy_file_range / CopyFile2), streaming hash-during-copy, restore progress UI, manifest details in History, task edit/search, history virtualization, responsive breakpoints, a11y + i18n pass.
