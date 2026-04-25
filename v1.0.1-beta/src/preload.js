const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Sélectionner un dossier
  selectDirectory: (title) => ipcRenderer.invoke('select-directory', title),

  // Contrôle des sauvegardes
  startBackup: (task) => ipcRenderer.invoke('start-backup', task),
  cancelBackup: (backupId) => ipcRenderer.invoke('cancel-backup', backupId),

  // Informations système
  getDiskSpace: (drivePath) => ipcRenderer.invoke('get-disk-space', drivePath),

  // Listeners pour les événements du processus principal
  onBackupProgress: (callback) => {
    ipcRenderer.on('backup-progress', (event, data) => callback(data));
  },
  onBackupComplete: (callback) => {
    ipcRenderer.on('backup-complete', (event, data) => callback(data));
  },

  // Cleanup
  removeBackupProgressListener: () => ipcRenderer.removeAllListeners('backup-progress'),
  removeBackupCompleteListener: () => ipcRenderer.removeAllListeners('backup-complete'),
});
