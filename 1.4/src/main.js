const { app, BrowserWindow, ipcMain, dialog, Notification, shell, session } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs').promises;
const fsCb = require('fs');
const { v4: uuidv4 } = require('uuid');

let mainWindow;
const backupTasks = new Map();

// Settings file path (per-user app data)
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const TASKS_PATH = path.join(app.getPath('userData'), 'tasks.json');
const HISTORY_PATH = path.join(app.getPath('userData'), 'history.json');

const DEFAULT_SETTINGS = {
  defaultDestination: '',
  compression: false,
  excludePatterns: '',
  autoCleanupDays: 0,
  confirmBeforeBackup: true,
  showNotifications: true,
  accentColor: 'brick',
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f4ead5',
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: process.platform !== 'darwin' ? {
      color: '#f4ead5',
      symbolColor: '#1a1a1a',
      height: 36,
    } : undefined,
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// CSP injection via response headers (silences Electron's dev warning)
function setupCSP() {
  const cspDev = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data:",
    "connect-src 'self' ws://localhost:* http://localhost:*",
  ].join('; ');

  const cspProd = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data:",
    "connect-src 'self'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? cspDev : cspProd],
      },
    });
  });
}

app.on('ready', () => {
  setupCSP();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ----- Persistence helpers -----

async function readJson(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ----- Settings IPC -----

ipcMain.handle('get-settings', async () => {
  const settings = await readJson(SETTINGS_PATH, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
});

ipcMain.handle('save-settings', async (event, settings) => {
  await writeJson(SETTINGS_PATH, settings);
  return { success: true };
});

// ----- Tasks IPC -----

ipcMain.handle('get-tasks', async () => readJson(TASKS_PATH, []));
ipcMain.handle('save-tasks', async (event, tasks) => {
  await writeJson(TASKS_PATH, tasks);
  return { success: true };
});

// ----- History IPC -----

ipcMain.handle('get-history', async () => readJson(HISTORY_PATH, []));
ipcMain.handle('save-history', async (event, history) => {
  await writeJson(HISTORY_PATH, history);
  return { success: true };
});

// ----- Directory operations -----

ipcMain.handle('select-directory', async (event, title = 'Select folder') => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title,
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  await shell.openPath(folderPath);
});

// ----- Backup engine -----

// Simple glob match (supports * and **)
function matchPattern(filePath, pattern) {
  if (!pattern) return false;
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/\\\\]*');
  const regex = new RegExp(`(^|[/\\\\])${regexStr}($|[/\\\\])`);
  return regex.test(filePath);
}

function shouldExclude(filePath, patterns) {
  if (!patterns || !patterns.trim()) return false;
  const list = patterns.split(',').map((p) => p.trim()).filter(Boolean);
  return list.some((p) => matchPattern(filePath, p));
}

async function copyFileWithProgress(src, dest, onProgress) {
  const stat = await fs.stat(src);
  const readStream = fsCb.createReadStream(src);
  const writeStream = fsCb.createWriteStream(dest);

  let copiedBytes = 0;
  const totalBytes = stat.size;

  readStream.on('data', (chunk) => {
    copiedBytes += chunk.length;
    if (totalBytes > 0) onProgress(copiedBytes / totalBytes);
  });

  return new Promise((resolve, reject) => {
    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    readStream.pipe(writeStream);
  });
}

async function copyDirectory(src, dest, opts) {
  const { onProgress, totalBytes, copiedBytes, excludePatterns, isCancelled } = opts;
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (isCancelled.value) return;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (shouldExclude(srcPath, excludePatterns)) continue;

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, opts);
    } else {
      const stat = await fs.stat(srcPath);
      await copyFileWithProgress(srcPath, destPath, (progress) => {
        const current = copiedBytes.value + stat.size * progress;
        onProgress(totalBytes.value > 0 ? current / totalBytes.value : 0);
      });
      copiedBytes.value += stat.size;
    }
  }
}

async function getDirectorySize(dir, excludePatterns) {
  let size = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (shouldExclude(filePath, excludePatterns)) continue;

    const stat = await fs.stat(filePath);
    if (entry.isDirectory()) {
      size += await getDirectorySize(filePath, excludePatterns);
    } else {
      size += stat.size;
    }
  }

  return size;
}

async function cleanupOldBackups(destination, days) {
  if (!days || days <= 0) return 0;
  try {
    const entries = await fs.readdir(destination, { withFileTypes: true });
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(destination, entry.name);
      const stat = await fs.stat(dirPath);
      if (stat.mtimeMs < cutoff) {
        await fs.rm(dirPath, { recursive: true, force: true });
        deleted++;
      }
    }
    return deleted;
  } catch (err) {
    return 0;
  }
}

ipcMain.handle('start-backup', async (event, task, settings) => {
  const backupId = uuidv4();
  const isCancelled = { value: false };
  backupTasks.set(backupId, { isCancelled });

  try {
    const srcStats = await fs.stat(task.source);
    if (!srcStats.isDirectory()) {
      throw new Error('Source folder not found');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeName = task.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const backupPath = path.join(task.destination, `${safeName}_${timestamp}`);

    const excludePatterns = settings?.excludePatterns || '';
    const totalBytes = { value: await getDirectorySize(task.source, excludePatterns) };
    const copiedBytes = { value: 0 };

    mainWindow.webContents.send('backup-started', { backupId, taskId: task.id });

    await copyDirectory(task.source, backupPath, {
      onProgress: (progress) => {
        if (!isCancelled.value) {
          mainWindow.webContents.send('backup-progress', {
            backupId,
            taskId: task.id,
            progress: Math.round(progress * 100),
            totalSize: (totalBytes.value / 1024 / 1024).toFixed(2),
          });
        }
      },
      totalBytes,
      copiedBytes,
      excludePatterns,
      isCancelled,
    });

    if (isCancelled.value) {
      // Clean up partial backup
      try { await fs.rm(backupPath, { recursive: true, force: true }); } catch (e) {}
      mainWindow.webContents.send('backup-complete', {
        backupId,
        taskId: task.id,
        success: false,
        cancelled: true,
      });
      backupTasks.delete(backupId);
      return { success: false, cancelled: true };
    }

    // Auto-cleanup
    let cleaned = 0;
    if (settings?.autoCleanupDays > 0) {
      cleaned = await cleanupOldBackups(task.destination, settings.autoCleanupDays);
    }

    // Notification
    if (settings?.showNotifications && Notification.isSupported()) {
      new Notification({
        title: 'Backup complete',
        body: `${task.name} — ${(totalBytes.value / 1024 / 1024).toFixed(1)} MB`,
        silent: false,
      }).show();
    }

    mainWindow.webContents.send('backup-complete', {
      backupId,
      taskId: task.id,
      success: true,
      path: backupPath,
      size: (totalBytes.value / 1024 / 1024).toFixed(2),
      cleaned,
    });

    backupTasks.delete(backupId);
    return { success: true, backupId, path: backupPath };
  } catch (error) {
    mainWindow.webContents.send('backup-complete', {
      backupId,
      taskId: task.id,
      success: false,
      error: error.message,
    });
    backupTasks.delete(backupId);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-backup', (event, taskId) => {
  for (const [id, backup] of backupTasks.entries()) {
    if (backup.isCancelled !== undefined) {
      backup.isCancelled.value = true;
    }
  }
});
