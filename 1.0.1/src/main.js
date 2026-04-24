const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs').promises;
const fsCb = require('fs');
const { v4: uuidv4 } = require('uuid');

let mainWindow;
const backupTasks = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
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

app.on('ready', createWindow);

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

// IPC: Dialogue pour sélectionner un dossier
ipcMain.handle('select-directory', async (event, title = 'Sélectionner un dossier') => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title,
  });
  return result.canceled ? null : result.filePaths[0];
});

// Fonction de copie de fichier avec progression
async function copyFileWithProgress(src, dest, onProgress) {
  const stat = await fs.stat(src);
  const readStream = fsCb.createReadStream(src);
  const writeStream = fsCb.createWriteStream(dest);
  
  let copiedBytes = 0;
  const totalBytes = stat.size;

  readStream.on('data', (chunk) => {
    copiedBytes += chunk.length;
    onProgress(copiedBytes / totalBytes);
  });

  return new Promise((resolve, reject) => {
    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    readStream.pipe(writeStream);
  });
}

// Fonction récursive de copie d'un répertoire
async function copyDirectory(src, dest, onProgress, totalBytes, copiedBytes) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, onProgress, totalBytes, copiedBytes);
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

// Calcul de la taille totale d'un répertoire
async function getDirectorySize(dir) {
  let size = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path_ = path.join(dir, entry.name);
    const stat = await fs.stat(path_);

    if (entry.isDirectory()) {
      size += await getDirectorySize(path_);
    } else {
      size += stat.size;
    }
  }

  return size;
}

// IPC: Lancer une sauvegarde
ipcMain.handle('start-backup', async (event, task) => {
  try {
    const backupId = uuidv4();
    let isCancelled = false;

    // Enregistrer le backup
    backupTasks.set(backupId, { isCancelled });

    // Vérifier que le dossier source existe
    const srcStats = await fs.stat(task.source);
    if (!srcStats.isDirectory()) {
      throw new Error('Le dossier source n\'existe pas');
    }

    // Créer le dossier de destination avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(task.destination, `${task.name}_${timestamp}`);

    // Calculer la taille totale
    const totalBytes = { value: await getDirectorySize(task.source) };
    const copiedBytes = { value: 0 };

    // Effectuer la copie
    await copyDirectory(task.source, backupPath, (progress) => {
      if (!isCancelled) {
        mainWindow.webContents.send('backup-progress', {
          backupId,
          progress: Math.round(progress * 100),
          totalSize: (totalBytes.value / 1024 / 1024).toFixed(2),
        });
      }
    }, totalBytes, copiedBytes);

    // Envoyer la confirmation
    mainWindow.webContents.send('backup-complete', {
      backupId,
      success: true,
      path: backupPath,
      size: (totalBytes.value / 1024 / 1024).toFixed(2),
    });

    backupTasks.delete(backupId);
    return { success: true, backupId, path: backupPath };
  } catch (error) {
    mainWindow.webContents.send('backup-complete', {
      success: false,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
});

// IPC: Annuler une sauvegarde
ipcMain.handle('cancel-backup', (event, backupId) => {
  if (backupTasks.has(backupId)) {
    backupTasks.get(backupId).isCancelled = true;
  }
});

// IPC: Obtenir l'espace disque disponible
ipcMain.handle('get-disk-space', async (event, drivePath) => {
  try {
    // Note: Sur Windows/Mac, vous pouvez utiliser des modules comme 'diskusage'
    // Pour cette démo, on retourne des valeurs simulées
    return {
      total: 1000, // GB
      used: 600,   // GB
      free: 400,   // GB
    };
  } catch (error) {
    return { error: error.message };
  }
});

module.exports = {};
