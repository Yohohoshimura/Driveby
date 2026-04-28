# Driveby 1.3

A local-drive backup app with a macOS-style sidebar UI — **Tauri 2 + Rust** backend, **React 18 + Vite** frontend.

1.3 builds on the 1.2 correctness pass with a **language switcher**: every user-visible string in the app is now run through a tiny in-tree i18n module, and Settings has an EN / FR picker that swaps the UI live.

> **Note on numbering:** what was previously branded `v2.x` was renumbered to `v1.x` (the actual 1.0+ shipping line, post-Tauri-rebrand). The pre-Tauri Electron snapshots that used to be `v1.x-beta` are now `v0.x-beta`. This README — and every README in `v1.0.0` / `v1.1.0` / `v1.2.0` / `v1.3.0` — refers to features by the new numbers; `conversation.md` keeps the original session-time labels for historical accuracy.

## What's new in 1.3

| Area | Change |
|------|--------|
| **i18n module** (`src/lib/i18n.js`) | Two locales — `en` (default) and `fr` — under a flat `area.subarea.purpose` key namespace. `{name}`-style interpolation, automatic fallback to English if a key is missing in the active locale, then to the key itself if it's missing everywhere. No build-time codegen, no runtime dependency. |
| **`useT()` hook** (`src/hooks/useT.js`) | Components call `const t = useT();` and use `t('key', { params })` directly. Inside `AppContext` itself (where the hook can't be used because the provider *is* the source of truth) a `tr()` helper is bound to a `settingsRef` so async event listeners always see the active language without re-binding. |
| **Settings — Language** | A new **Language** section in `Settings.jsx`, sitting between Appearance and Diagnostics. Two-button segmented picker (English / Français). Choosing one writes `language` into `settings.json` via `bridge.saveSettings`; the rest of the UI re-renders on the next paint because every component reads through `useT`, which depends on `settings.language`. |
| **Persisted across runs** | `language` is part of `default_settings()` in `src-tauri/src/main.rs` (and `DEFAULT_SETTINGS` in `AppContext.jsx`), so it round-trips through `get_settings` / `save_settings` like every other preference. |
| **Translation coverage** | `App` (loading, view titles), `Sidebar` (sections, items, search placeholder, brand version, region aria), `Toolbar` (sidebar toggle aria), `Home` (header, new-task button, empty state, toasts), `TaskCard` (last-run line, all four actions and aria-labels, schedule labels), `NewTaskForm` (every label/placeholder/option/error/dialog title), `Settings` (every section, label, tip, theme option, button, log toast), `History` (header, search, filter, columns, status badges, row actions, empty state), `Statistics` (block headers, chart aria-labels and tooltips, both empty states, legend), `ConfirmDialog` (Cancel + OK fallback). Backup-progress / restore-progress events stay in the language they were emitted in (Rust) — those are tracing logs, not UI. |
| **Brand untouched** | "Driveby" stays "Driveby" — it's a brand, not a translatable noun. |

## Folder-icon hash verification (post-1.3 patch)

After 1.3 shipped, the per-subfolder icon round-trip from 1.2 was reinforced with a hash-verification phase so destinations can never silently drift from the source's icon state. Three layers now:

1. **`desktop.ini` is never short-circuited.** The size+mtime fast path that skips already-current files explicitly excludes folder-icon descriptors. Every backup re-copies them, so a stale or tampered destination copy can never silently survive a sync.
2. **Hash-verification pass (`phase: "verifying-icons"`).** After the main copy loop and the prune pass, every `desktop.ini` under the source is hashed via xxh3 and compared to its destination twin. Any mismatch is logged at `WARN` level and force-re-copied through `copy_with_retries`. Reported in tracing as `re-synced N folder-icon descriptor(s)` or `verified N folder-icon descriptor(s) — all match source`.
3. **Read-after-apply attribute verification.** The directory-attribute mirror loop re-reads each destination folder's attrs after `SetFileAttributesW` and warns when the `Readonly`/`Hidden`/`System` bits we wanted didn't actually stick. This is what surfaces filesystem-level limitations — exFAT, for example, doesn't support per-folder `+R` on directories the way NTFS does, and previously this would silently produce default icons. The total attribute drift count is also logged as a single summary warning so a glance at the log tells you "nothing took" vs "one folder out of fifty had trouble".

The hash-verify and attr-verify steps run *before* the final 100 % progress emit, so a backup that completes successfully has provably reached a state where every folder-icon descriptor and every parent-folder attribute matches the source.

## Adding a third language

1. Add a new sibling object under `MESSAGES` in `src/lib/i18n.js` keyed by the BCP-47 code (e.g. `'es'`).
2. Add the code to `SUPPORTED_LANGUAGES` and a label to `LANGUAGE_LABELS`.
3. The picker in `Settings.jsx` iterates `SUPPORTED_LANGUAGES`, so a new button appears automatically.
4. Missing keys fall back to English — you can ship partial translations and fill in over time.

## Prerequisites / Running

```bash
cd v1.3.0
npm install
npm run tauri dev
npm run tauri build
```

## What's retained from 1.2

Every 1.2 fix carries forward unchanged: atomic concurrent-run guard, exclude-aware prune, source/dest overlap check, 2-second mtime tolerance for FAT/exFAT, restore durability + error surfacing, shared `tasks.json` lock, `continueOnError` on `create_dir_all`, final-failure cleanup in `copy_with_retries`, no-thundering-herd scheduler, single-slice pies render as `<circle>`, memoised key bindings, no dangling confirm promises, destination root keeps its icon, per-subfolder icons round-trip, accent fixed to default blue, dead-code prune (Manifest / read_manifest / incremental / autoCleanupDays / accent picker), refreshed app icon (red external-drive design, transparent background).

## Open items for 1.4+

Locale-aware date/number formatting (`Intl.DateTimeFormat` / `Intl.NumberFormat` driven by the active language), RTL sweep if Arabic/Hebrew ever land, parallel copies, platform-native fast copy (clonefile / copy_file_range / CopyFile2), streaming hash-during-copy, true per-run snapshots with restore-from-snapshot, history virtualization.
