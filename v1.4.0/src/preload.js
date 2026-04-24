const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Persistence
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (history) => ipcRenderer.invoke('save-history', history),

  // Folder operations
  selectDirectory: (title) => ipcRenderer.invoke('select-directory', title),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // Backup
  startBackup: (task, settings) => ipcRenderer.invoke('start-backup', task, settings),
  cancelBackup: (taskId) => ipcRenderer.invoke('cancel-backup', taskId),

  // Listeners
  onBackupStarted: (cb) => ipcRenderer.on('backup-started', (e, data) => cb(data)),
  onBackupProgress: (cb) => ipcRenderer.on('backup-progress', (e, data) => cb(data)),
  onBackupComplete: (cb) => ipcRenderer.on('backup-complete', (e, data) => cb(data)),

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('backup-started');
    ipcRenderer.removeAllListeners('backup-progress');
    ipcRenderer.removeAllListeners('backup-complete');
  },
});
