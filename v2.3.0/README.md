# Driveby 2.3

A local-drive backup app with a macOS-style sidebar UI — **Tauri 2 + Rust** backend, **React 18 + Vite** frontend.

2.3 builds on the 2.2 correctness pass with a **language switcher**: every user-visible string in the app is now run through a tiny in-tree i18n module, and Settings has an EN / FR picker that swaps the UI live.

## What's new in 2.3

| Area | Change |
|------|--------|
| **i18n module** (`src/lib/i18n.js`) | Two locales — `en` (default) and `fr` — under a flat `area.subarea.purpose` key namespace. `{name}`-style interpolation, automatic fallback to English if a key is missing in the active locale, then to the key itself if it's missing everywhere. No build-time codegen, no runtime dependency. |
| **`useT()` hook** (`src/hooks/useT.js`) | Components call `const t = useT();` and use `t('key', { params })` directly. Inside `AppContext` itself (where the hook can't be used because the provider *is* the source of truth) a `tr()` helper is bound to a `settingsRef` so async event listeners always see the active language without re-binding. |
| **Settings — Language** | A new **Language** section in `Settings.jsx`, sitting between Appearance and Diagnostics. Two-button segmented picker (English / Français). Choosing one writes `language` into `settings.json` via `bridge.saveSettings`; the rest of the UI re-renders on the next paint because every component reads through `useT`, which depends on `settings.language`. |
| **Persisted across runs** | `language` is part of `default_settings()` in `src-tauri/src/main.rs` (and `DEFAULT_SETTINGS` in `AppContext.jsx`), so it round-trips through `get_settings` / `save_settings` like every other preference. |
| **Translation coverage** | `App` (loading, view titles), `Sidebar` (sections, items, search placeholder, brand version, region aria), `Toolbar` (sidebar toggle aria), `Home` (header, new-task button, empty state, toasts), `TaskCard` (last-run line, all four actions and aria-labels, schedule labels), `NewTaskForm` (every label/placeholder/option/error/dialog title), `Settings` (every section, label, tip, theme option, button, log toast), `History` (header, search, filter, columns, status badges, row actions, empty state), `Statistics` (block headers, chart aria-labels and tooltips, both empty states, legend), `ConfirmDialog` (Cancel + OK fallback). Backup-progress / restore-progress events stay in the language they were emitted in (Rust) — those are tracing logs, not UI. |
| **Brand untouched** | "Driveby" stays "Driveby" — it's a brand, not a translatable noun. |

## Adding a third language

1. Add a new sibling object under `MESSAGES` in `src/lib/i18n.js` keyed by the BCP-47 code (e.g. `'es'`).
2. Add the code to `SUPPORTED_LANGUAGES` and a label to `LANGUAGE_LABELS`.
3. The picker in `Settings.jsx` iterates `SUPPORTED_LANGUAGES`, so a new button appears automatically.
4. Missing keys fall back to English — you can ship partial translations and fill in over time.

## Prerequisites / Running

```bash
cd v2.3.0
npm install
npm run tauri dev
npm run tauri build
```

## What's retained from 2.2

Every 2.2 fix carries forward unchanged: atomic concurrent-run guard, exclude-aware prune, source/dest overlap check, 2-second mtime tolerance for FAT/exFAT, restore durability + error surfacing, shared `tasks.json` lock, `continueOnError` on `create_dir_all`, final-failure cleanup in `copy_with_retries`, no-thundering-herd scheduler, single-slice pies render as `<circle>`, memoised key bindings, no dangling confirm promises, destination root keeps its icon, per-subfolder icons round-trip, accent fixed to default blue, dead-code prune (Manifest / read_manifest / incremental / autoCleanupDays / accent picker), refreshed app icon (orange external-drive design).

## Open items for 2.4+

Locale-aware date/number formatting (`Intl.DateTimeFormat` / `Intl.NumberFormat` driven by the active language), RTL sweep if Arabic/Hebrew ever land, parallel copies, platform-native fast copy (clonefile / copy_file_range / CopyFile2), streaming hash-during-copy, true per-run snapshots with restore-from-snapshot, history virtualization.
