# BackupDrive

Lightweight desktop application for backing up data to local drives. Built with Electron and React.

## Features

- Create and manage multiple backup tasks
- Real-time progress tracking with file size calculation
- Complete backup history with timestamps
- Dashboard with statistics (total backed up, backup count, last backup)
- Secure IPC with Electron Context Isolation
- Light mode UI with clean design
- Cross-platform (Windows, macOS, Linux)

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm 8+

### Installation

```bash
git clone https://github.com/yourusername/backup-drive.git
cd backup-drive
npm install
```

### Development

```bash
npm run dev
```

This starts both React (localhost:3000) and Electron together.

### Build

```bash
npm run build
```

Creates distributable executables in `dist/` folder.

## Architecture

### Main Process (src/main.js)
- Window management
- IPC handlers
- File system operations
- Directory selection dialogs

### Renderer (src/App.jsx)
- React 18 with Hooks
- Tailwind CSS styling
- Lucide React icons
- Real-time backup monitoring

### Security
- Context Isolation enabled
- Preload script for controlled IPC
- No Node.js access from renderer
- Path validation before operations

## Project Structure

```
backup-drive/
├── src/
│   ├── main.js       Electron main process
│   ├── preload.js    IPC security bridge
│   ├── App.jsx       React application
│   └── index.jsx     React entry point
├── public/
│   └── index.html    HTML template
├── package.json      Dependencies and scripts
├── electron-builder.json  Build configuration
└── README.md         This file
```

## Available Scripts

### Development
```bash
npm run dev              # Start dev environment (React + Electron)
npm run react-start      # React only (localhost:3000)
npm run electron-dev     # Electron only
```

### Production
```bash
npm run build            # Build React
npm run electron-build   # Package application
```

## Technologies

- **Electron** - Desktop framework
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **electron-builder** - Packaging

## Usage

1. Click "New Task"
2. Select source folder (files to backup)
3. Select destination folder (backup location)
4. Choose schedule (manual, daily, weekly, monthly)
5. Click "Add"
6. Click "Start" to begin backup
7. Monitor progress in real-time
8. View backup history

## File Operations

The app copies entire directory trees recursively:
- Calculates total size before backup
- Streams data with progress updates
- Can be cancelled mid-operation
- Creates timestamped backup folders

## Platform-specific Builds

### Windows
```bash
npm run electron-build
# Creates: Setup installer + Portable exe
```

### macOS
```bash
npm run electron-build
# Creates: DMG + ZIP
```

### Linux
```bash
npm run electron-build
# Creates: AppImage + DEB
```

## Known Issues

- Schedule automation not yet implemented (manual only)
- No file exclusion patterns
- No compression or encryption

## Roadmap

### v0.2.0-beta (planned 1.1)
- Scheduled backups
- File exclusion patterns
- System notifications

### v0.3.0-beta (planned 1.2)
- Backup compression
- File integrity checking
- Restoration from history

### v2.0
- Cloud storage support
- Incremental backups
- Multi-device sync

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or suggestions:
1. Check existing issues on GitHub
2. Check the troubleshooting guide
3. Create a new issue with details

## Changelog

### v0.1.0-beta (was 1.0.1)
- Fixed npm package.json syntax error
- Added electron-is-dev dependency
- Converted to CommonJS modules
- Comprehensive documentation

### v0.0.1-beta (was 1.0)
- Initial release
- Core backup functionality
- Real-time progress tracking
- Backup history and statistics

---

**Status:** Production Ready | **Last Updated:** April 2024
