const { app, BrowserWindow, ipcMain, dialog, Notification, shell, session, nativeTheme } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs').promises;
const fsCb = require('fs');
const { v4: uuidv4 } = require('uuid');

let mainWindow = null;
const backupTasks = new Map();

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const TASKS_PATH = path.join(app.getPath('userData'), 'tasks.json');
const HISTORY_PATH = path.join(app.getPath('userData'), 'history.json');

const DEFAULT_SETTINGS = {
  defaultDestination: '',
  excludePatterns: '',
  autoCleanupDays: 0,
  confirmBeforeBackup: true,
  showNotifications: true,
  accentColor: 'brick',
  theme: 'light',
};

const BACKUP_FOLDER_RE = /^[A-Za-z0-9_-]+_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#f6f6f6',
    vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: process.platform !== 'darwin' ? {
      color: '#f6f6f6',
      symbolColor: '#1a1a1a',
      height: 52,
    } : undefined,
    trafficLightPosition: { x: 14, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3000') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    for (const { abort } of backupTasks.values()) abort?.abort();
    mainWindow = null;
  });
}

function setupCSP() {
  const cspDev = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    "connect-src 'self' ws://localhost:* http://localhost:*",
  ].join('; ');

  const cspProd = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
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
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

function safeSend(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

async function readJson(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

ipcMain.handle('get-settings', async () => {
  const s = await readJson(SETTINGS_PATH, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...s };
});
ipcMain.handle('save-settings', async (_e, settings) => {
  await writeJson(SETTINGS_PATH, settings);
  if (settings?.theme && ['light', 'dark', 'system'].includes(settings.theme)) {
    nativeTheme.themeSource = settings.theme;
  }
  return { success: true };
});

ipcMain.handle('set-theme-source', (_e, source) => {
  if (['light', 'dark', 'system'].includes(source)) {
    nativeTheme.themeSource = source;
  }
  return { shouldUseDark: nativeTheme.shouldUseDarkColors };
});

ipcMain.handle('get-tasks', async () => readJson(TASKS_PATH, []));
ipcMain.handle('save-tasks', async (_e, tasks) => {
  await writeJson(TASKS_PATH, tasks);
  return { success: true };
});

ipcMain.handle('get-history', async () => readJson(HISTORY_PATH, []));
ipcMain.handle('save-history', async (_e, history) => {
  await writeJson(HISTORY_PATH, history);
  return { success: true };
});

ipcMain.handle('select-directory', async (_e, title = 'Select folder') => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title,
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('reveal-folder', async (_e, folderPath) => {
  if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
    return { success: false, error: 'Invalid path' };
  }
  const history = await readJson(HISTORY_PATH, []);
  const tasks = await readJson(TASKS_PATH, []);
  const knownRoots = new Set([
    ...history.map((h) => h.path).filter(Boolean),
    ...tasks.map((t) => t.destination).filter(Boolean),
    ...tasks.map((t) => t.source).filter(Boolean),
  ]);
  const resolved = path.resolve(folderPath);
  const isKnown = [...knownRoots].some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
  if (!isKnown) return { success: false, error: 'Path not allowed' };
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) return { success: false, error: 'Not a directory' };
  } catch {
    return { success: false, error: 'Missing path' };
  }
  shell.showItemInFolder(resolved);
  return { success: true };
});

function matchOne(relPath, pattern) {
  if (!pattern) return false;
  const neg = pattern.startsWith('!');
  const p = neg ? pattern.slice(1) : pattern;
  const normalized = relPath.replace(/\\/g, '/');
  const regex = globToRegex(p);
  const hit = regex.test(normalized) || regex.test(path.posix.basename(normalized));
  return neg ? { negated: true, hit } : { negated: false, hit };
}

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}

function shouldExclude(relPath, patternString) {
  if (!patternString || !patternString.trim()) return false;
  const patterns = patternString
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  let excluded = false;
  for (const p of patterns) {
    const r = matchOne(relPath, p);
    if (!r) continue;
    if (r.hit) excluded = r.negated ? false : true;
  }
  return excluded;
}

async function walk(root, excludePatterns, onSkip) {
  const files = [];
  const dirs = [];
  let totalBytes = 0;

  async function recurse(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      onSkip?.(current, err);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const rel = path.relative(root, fullPath);
      if (entry.isSymbolicLink()) continue;
      if (shouldExclude(rel, excludePatterns)) continue;
      if (entry.isDirectory()) {
        dirs.push(fullPath);
        await recurse(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.lstat(fullPath);
          files.push({ path: fullPath, rel, size: stat.size });
          totalBytes += stat.size;
        } catch (err) {
          onSkip?.(fullPath, err);
        }
      }
    }
  }

  await recurse(root);
  return { files, dirs, totalBytes };
}

function copyFileStream(src, dest, onBytes, abortSignal) {
  return new Promise((resolve, reject) => {
    const readStream = fsCb.createReadStream(src);
    const writeStream = fsCb.createWriteStream(dest);
    let settled = false;
    const cleanup = () => {
      abortSignal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      readStream.destroy();
      writeStream.destroy();
      cleanup();
      reject(new Error('ABORTED'));
    };
    if (abortSignal.aborted) return onAbort();
    abortSignal.addEventListener('abort', onAbort);

    readStream.on('data', (chunk) => onBytes(chunk.length));
    readStream.on('error', (err) => {
      if (settled) return;
      settled = true;
      writeStream.destroy();
      cleanup();
      reject(err);
    });
    writeStream.on('error', (err) => {
      if (settled) return;
      settled = true;
      readStream.destroy();
      cleanup();
      reject(err);
    });
    writeStream.on('finish', () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    });
    readStream.pipe(writeStream);
  });
}

async function cleanupOldBackups(destination, days, safeName) {
  if (!days || days <= 0) return 0;
  try {
    const entries = await fs.readdir(destination, { withFileTypes: true });
    const cutoff = Date.now() - days * 86400000;
    let deleted = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!BACKUP_FOLDER_RE.test(entry.name)) continue;
      if (safeName && !entry.name.startsWith(`${safeName}_`)) continue;
      const dirPath = path.join(destination, entry.name);
      const stat = await fs.stat(dirPath);
      if (stat.mtimeMs < cutoff) {
        await fs.rm(dirPath, { recursive: true, force: true });
        deleted++;
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}

ipcMain.handle('start-backup', async (_e, task, settings) => {
  const backupId = uuidv4();
  const abort = new AbortController();
  backupTasks.set(backupId, { taskId: task.id, abort });

  let backupPath = null;

  try {
    if (!task?.source || !task?.destination) throw new Error('Invalid task');
    if (!path.isAbsolute(task.source) || !path.isAbsolute(task.destination)) {
      throw new Error('Paths must be absolute');
    }

    const srcStats = await fs.stat(task.source).catch(() => null);
    if (!srcStats || !srcStats.isDirectory()) throw new Error('Source folder not found');

    const destStats = await fs.stat(task.destination).catch(() => null);
    if (!destStats || !destStats.isDirectory()) throw new Error('Destination not found');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeName = (task.name || 'backup').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    backupPath = path.join(task.destination, `${safeName}_${timestamp}`);

    const excludePatterns = settings?.excludePatterns || '';
    const skipped = [];
    safeSend('backup-started', { backupId, taskId: task.id });

    const { files, totalBytes } = await walk(task.source, excludePatterns, (p, err) => {
      skipped.push({ path: p, error: err.message });
    });

    await fs.mkdir(backupPath, { recursive: true });

    const startedAt = Date.now();
    let copiedBytes = 0;
    let copiedFiles = 0;
    let lastTick = 0;

    for (const file of files) {
      if (abort.signal.aborted) throw new Error('ABORTED');
      const destPath = path.join(backupPath, file.rel);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await copyFileStream(
        file.path,
        destPath,
        (delta) => {
          copiedBytes += delta;
          const now = Date.now();
          if (now - lastTick >= 100) {
            lastTick = now;
            const elapsed = (now - startedAt) / 1000;
            const speed = elapsed > 0 ? copiedBytes / elapsed : 0;
            const remaining = totalBytes - copiedBytes;
            const eta = speed > 0 ? Math.round(remaining / speed) : null;
            safeSend('backup-progress', {
              backupId,
              taskId: task.id,
              progress: totalBytes > 0 ? Math.min(100, Math.round((copiedBytes / totalBytes) * 100)) : 0,
              copiedBytes,
              totalBytes,
              copiedFiles,
              totalFiles: files.length,
              speedBps: Math.round(speed),
              etaSeconds: eta,
            });
          }
        },
        abort.signal
      );
      copiedFiles++;
    }

    let cleaned = 0;
    if (settings?.autoCleanupDays > 0) {
      cleaned = await cleanupOldBackups(task.destination, settings.autoCleanupDays, safeName);
    }

    if (settings?.showNotifications && Notification.isSupported()) {
      new Notification({
        title: 'Backup complete',
        body: `${task.name} — ${(totalBytes / 1048576).toFixed(1)} MB`,
        silent: false,
      }).show();
    }

    safeSend('backup-complete', {
      backupId,
      taskId: task.id,
      success: true,
      path: backupPath,
      totalBytes,
      totalFiles: files.length,
      durationMs: Date.now() - startedAt,
      cleaned,
      skipped: skipped.length,
    });

    backupTasks.delete(backupId);
    return { success: true, backupId, path: backupPath };
  } catch (error) {
    const cancelled = error.message === 'ABORTED';
    if (backupPath) {
      try { await fs.rm(backupPath, { recursive: true, force: true }); } catch {}
    }
    safeSend('backup-complete', {
      backupId,
      taskId: task.id,
      success: false,
      cancelled,
      error: cancelled ? null : error.message,
    });
    backupTasks.delete(backupId);
    return { success: false, cancelled, error: cancelled ? null : error.message };
  }
});

ipcMain.handle('cancel-backup', (_e, taskId) => {
  for (const backup of backupTasks.values()) {
    if (backup.taskId === taskId) backup.abort.abort();
  }
  return { success: true };
});
