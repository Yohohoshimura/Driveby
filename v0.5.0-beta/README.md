# BackupDrive 0.5 (beta)

A macOS-style desktop backup application. Built with Electron and React, inspired by Apple HIG and [macos_ui](https://github.com/macosui/macos_ui).

## What's new in 1.5

A correctness, security, and architecture overhaul. See `../claude_report.md` for the full audit of 1.4.

### Correctness
- **Per-task cancel** — stopping one backup no longer cancels all running backups.
- **Stream abort** — in-flight file copies are aborted immediately via `AbortController`, not just between files.
- **Partial-backup cleanup on any failure** — error paths now remove the incomplete backup folder, not just cancellations.
- **Single-pass walk** — removed the double tree walk; total size and file list are gathered once.
- **Symlink safety** — symbolic links are skipped to prevent infinite recursion on loops.
- **Per-file error tolerance** — unreadable files are logged as `skipped`, the backup continues.
- **Safe IPC** — `mainWindow.webContents.send` is guarded against destroyed windows.
- **UUID IDs** — history and task IDs use UUIDs; no more `Date.now()` collisions.
- **Atomic JSON writes** — write-to-tmp + rename pattern prevents torn settings/tasks/history files.

### Security
- **Hardened BrowserWindow** — `sandbox: true`, `webSecurity: true`, `setWindowOpenHandler` deny, `will-navigate` blocked.
- **Reveal instead of open** — `open-folder` became `reveal-folder`: uses `shell.showItemInFolder`, validates the path exists, is absolute, is a directory, and is inside a known history/task root.
- **Tightened CSP** — production CSP drops `unsafe-eval`, removes Google Fonts origins (fonts are bundled).
- **Bundled fonts** — `@fontsource` packages (Bebas Neue, Fraunces Variable, JetBrains Mono); app works offline.
- **Input validation** — absolute-path check on source/destination before starting a backup.

### Architecture
- **Split** — `App.js` (1093 LOC) became 15 small files under `src/components/`, `src/context/`, `src/hooks/`, `src/lib/`.
- **Context** — `AppContext` replaces prop drilling; single source of truth for tasks/history/settings/backups.
- **Extracted CSS** — inline styles gone; `styles.css` uses CSS variables and BEM-ish class names.
- **Dark mode** — `data-theme="dark"` on `<html>`, persisted as a setting.
- **Pinned dependencies** — exact versions, reproducible builds.
- **ESLint + Jest** — `npm run lint` and `npm test` included; one unit test covers the glob engine.
- **Proper glob engine** — `src/lib/glob.js` supports `*`, `**`, `?`, negation (`!pattern`), newline *or* comma separation.
- **Safer cleanup** — `cleanupOldBackups` only deletes folders matching `<safeName>_<iso-timestamp>`; unrelated folders in the destination are untouched.

### UI — macOS design language
- **SF-style typography** (`-apple-system`, `SF Pro`, `SF Mono`) with proper scale (13px body, weight 500/600).
- **Translucent window chrome** — `vibrancy: 'sidebar'` on macOS + `backdrop-filter` fallback on Win/Linux.
- **Segmented control** for Tasks/Preferences navigation (native-feeling pill).
- **Grouped inset lists** (`.group`) — rounded 12px cards with hairline separators, matching System Settings.
- **macOS switches** — green-when-on (`#34c759`), 36×22 with proper spring knob.
- **Push buttons** — 28px default height, 6px radius, filled primary vs bordered default.
- **Apple system colors** — blue/purple/pink/red/orange/yellow/green/graphite accents.
- **Materials & shadows** — 0.5px hairlines, soft layered shadows, proper focus rings (3px tinted).
- **Native confirm sheet** — centered modal with backdrop blur, ⏎ Enter / ⎋ Escape.
- **Toast capsule** — pill-shaped, bottom-centered, `backdrop-filter` blur.
- **Light / Dark / System** theme mode with automatic follow on macOS.
- **Traffic lights** (macOS) via `titleBarStyle: 'hiddenInset'`; `titleBarOverlay` on Win/Linux.

### UX
- Real progress: files/total, bytes/total, speed, ETA, duration.
- Keyboard: `⌘N` new task, `⌘1` Tasks, `⌘2` / `⌘,` Preferences, `⎋` closes dialogs.
- Drag-and-drop folders onto Source or Destination fields.
- History search and status filter.
- Accessibility: `role="switch"`, `aria-live` on progress, focus rings, reduced-motion.
- Working scheduler (`daily` / `weekly` / `monthly` while app is open).
- Compression removed (was dead).

## Project structure

```
src/
  main.js              # Electron main process — backup engine, IPC, security
  preload.js           # contextBridge with per-channel subscriptions
  index.js             # React entry, font imports
  App.js               # Shell + routing
  styles.css           # Theme, dark mode, component styles
  context/AppContext.js
  hooks/
    useKeyboard.js
    useScheduler.js
  lib/
    accent.js
    format.js
    glob.js            # + glob.test.js
  components/
    TitleBar.js Header.js Footer.js
    Home.js TaskCard.js NewTaskForm.js History.js
    Settings.js ConfirmDialog.js Toast.js
    common/ Button Toggle EmptyState FormField
```

## Quick Start

```bash
cd v0.5.0-beta
npm install
npm run dev      # React dev server + Electron
```

Requires Node 18+ and npm 9+.

## Scripts

| Command                | Description                          |
|------------------------|--------------------------------------|
| `npm run dev`          | React + Electron dev mode            |
| `npm run build`        | Production React build               |
| `npm run electron-build` | Build installers (Win/macOS/Linux) |
| `npm test`             | Run Jest unit tests                  |
| `npm run lint`         | ESLint on `src/`                     |

## Known limits

- Scheduled backups require BackupDrive to be running.
- No pause/resume (only cancel).
- No encryption or compression (roadmap for 1.6).
- No multi-language UI.
