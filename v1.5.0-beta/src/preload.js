const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map();

function subscribe(channel, cb) {
  const wrapped = (_e, data) => cb(data);
  ipcRenderer.on(channel, wrapped);
  const existing = listeners.get(channel) || [];
  existing.push(wrapped);
  listeners.set(channel, existing);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
    const list = (listeners.get(channel) || []).filter((fn) => fn !== wrapped);
    listeners.set(channel, list);
  };
}

contextBridge.exposeInMainWorld('electron', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (history) => ipcRenderer.invoke('save-history', history),

  selectDirectory: (title) => ipcRenderer.invoke('select-directory', title),
  revealFolder: (folderPath) => ipcRenderer.invoke('reveal-folder', folderPath),

  startBackup: (task, settings) => ipcRenderer.invoke('start-backup', task, settings),
  cancelBackup: (taskId) => ipcRenderer.invoke('cancel-backup', taskId),
  setThemeSource: (source) => ipcRenderer.invoke('set-theme-source', source),

  onBackupStarted: (cb) => subscribe('backup-started', cb),
  onBackupProgress: (cb) => subscribe('backup-progress', cb),
  onBackupComplete: (cb) => subscribe('backup-complete', cb),
});
