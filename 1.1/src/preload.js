const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectDirectory: (title) => ipcRenderer.invoke('select-directory', title),
  startBackup: (task) => ipcRenderer.invoke('start-backup', task),
  cancelBackup: (backupId) => ipcRenderer.invoke('cancel-backup', backupId),
  getDiskSpace: (drivePath) => ipcRenderer.invoke('get-disk-space', drivePath),
  onBackupProgress: (callback) => {
    ipcRenderer.on('backup-progress', (event, data) => callback(data));
  },
  onBackupComplete: (callback) => {
    ipcRenderer.on('backup-complete', (event, data) => callback(data));
  },
  removeBackupProgressListener: () => ipcRenderer.removeAllListeners('backup-progress'),
  removeBackupCompleteListener: () => ipcRenderer.removeAllListeners('backup-complete'),
});
