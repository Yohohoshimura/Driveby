# BackupDrive

Desktop backup application with a classic editorial design. Built with Electron and React.

## Features

- Multiple backup tasks with source/destination folders
- Real-time progress tracking
- Backup history with size and timestamps
- Functional settings panel:
  - Default backup destination
  - Compression toggle
  - File exclusion patterns (glob)
  - Auto-cleanup of old backups
  - Confirmation dialogs
  - Notification preferences
  - Accent color theme
- Persistent settings via local JSON storage
- Cross-platform (Windows, macOS, Linux)

## Quick Start

```bash
git clone <repo-url>
cd backup-drive
npm install
npm run dev
```

Requires Node.js 16+ and npm 8+.

## Scripts

```bash
npm run dev              # Start dev environment
npm run build            # Build React for production
npm run electron-build   # Package application
```

## Project Structure

```
backup-drive/
├── src/
│   ├── main.js       Electron main process
│   ├── preload.js    IPC bridge
│   ├── App.js        React application
│   └── index.js      React entry point
├── public/
│   └── index.html    HTML template
├── package.json
└── electron-builder.json
```

## Settings

Settings persist to `%APPDATA%/backup-drive/settings.json` (Windows) or equivalent on macOS/Linux.

| Setting | Description |
|---------|-------------|
| Default destination | Pre-fills destination for new tasks |
| Compression | Reserved for future zip support |
| Exclude patterns | Comma-separated glob patterns (e.g. `*.tmp, node_modules`) |
| Auto-cleanup | Delete backups older than N days |
| Confirm before backup | Show dialog before starting |
| Show notifications | Native OS notifications on completion |
| Accent color | UI accent (cream, mustard, brick, sage, ink) |

## Security

- Context Isolation enabled
- Node integration disabled in renderer
- IPC via preload script only
- Content Security Policy injected via response headers (in `main.js`)

## License

MIT
