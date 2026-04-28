# BackupDrive 0.6 (beta)

A local-drive backup app with a macOS-style sidebar UI — **Tauri 2 + Rust** backend, **React 18 + Vite** frontend.

Version 0.6 is a ground-up port of 0.5 from Electron to Tauri. You keep the same UX you had — now with a ~10× smaller installer, lower memory use, and a safer native backend.

## Highlights

- **Sidebar layout** (Tasks · History · Preferences) with in-sidebar search, inspired by `macos_ui`.
- **Rust backend** — `tokio::fs` copies with per-file progress, `CancellationToken` cancellation, atomic JSON persistence (tmp + rename).
- **Real glob engine** — `*`, `**`, `?`, comma/newline-separated, `!pattern` re-include.
- **Safe cleanup** — only deletes folders whose name matches `<taskName>_<ISO-timestamp>`.
- **Light / Dark / System** theme; 8 accent colors; native `prefers-color-scheme` follow.

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
cd v0.6.0-beta
npm install

# run in dev (Vite on :1420 + Tauri window)
npm run tauri dev

# build a production installer (.dmg / .msi / .AppImage)
npm run tauri build
```

## Icons

Add these in `src-tauri/icons/` before the first build:

- `32x32.png`, `128x128.png`, `128x128@2x.png`
- `icon.icns` (macOS), `icon.ico` (Windows)

Tauri's CLI can generate them from a single source image:

```bash
npx @tauri-apps/cli icon path/to/source-1024.png
```

## Project layout

```
v0.6.0-beta/
├─ index.html
├─ package.json
├─ vite.config.js
├─ src/                 # React frontend
│  ├─ App.jsx           # shell: sidebar + toolbar + view switch
│  ├─ main.jsx
│  ├─ styles.css        # macOS sidebar layout
│  ├─ components/
│  │  ├─ Sidebar.jsx    # search, nav groups, footer
│  │  ├─ Toolbar.jsx    # sidebar toggle + title
│  │  ├─ Home.jsx, TaskCard.jsx, NewTaskForm.jsx
│  │  ├─ History.jsx, Settings.jsx
│  │  ├─ ConfirmDialog.jsx, Toast.jsx
│  │  └─ common/        # Button, Toggle, FormField, EmptyState
│  ├─ context/AppContext.jsx
│  ├─ hooks/            # useKeyboard, useScheduler, useSystemTheme
│  └─ lib/              # tauri.js (adapter), format.js, accent.js
└─ src-tauri/           # Rust backend
   ├─ Cargo.toml
   ├─ tauri.conf.json
   ├─ capabilities/default.json
   └─ src/
      ├─ main.rs        # Builder + 8 IPC commands
      ├─ backup.rs      # run_backup, walk, copy_file, cleanup
      ├─ glob.rs        # *, **, ?, !negation
      └─ persist.rs     # atomic JSON read/write
```

## IPC surface

Commands (JS → Rust):

- `get_settings` / `save_settings`
- `get_tasks` / `save_tasks`
- `get_history` / `save_history`
- `start_backup { task, settings }` → emits `backup-started`, `backup-progress`, `backup-complete`
- `cancel_backup { taskId }`

Events (Rust → JS) carry camelCase payloads (see `src-tauri/src/backup.rs`).

## Keyboard

- `⌘/Ctrl + 1` — Tasks
- `⌘/Ctrl + 2` — History
- `⌘/Ctrl + 3` / `⌘/Ctrl + ,` — Preferences
- `⌘/Ctrl + S` — Toggle sidebar
- `⌘/Ctrl + N` — New task (on Tasks view)
- `Esc` — Close form / dialog

## Notes vs 1.5

- Drag-and-drop of folders into the form is removed — Tauri webviews don't expose an absolute path for dropped files the way Electron did. Use **Choose…** instead.
- Settings `confirmBeforeBackup`, `showNotifications`, `theme`, `accentColor` are UI-only; they pass through Rust via a `#[serde(flatten)]` field so the backend ignores them safely.
- Scheduler still runs in the React layer — automatic backups require the app to be open (same as 1.5).
