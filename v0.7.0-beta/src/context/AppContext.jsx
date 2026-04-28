import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { bridge } from '../lib/tauri';
import { useSystemTheme } from '../hooks/useSystemTheme';
import { DEFAULT_ACCENT } from '../lib/accent';

const AppContext = createContext(null);

const DEFAULT_SETTINGS = {
  defaultDestination: '',
  excludePatterns: '',
  autoCleanupDays: 0,
  confirmBeforeBackup: true,
  showNotifications: true,
  accentColor: DEFAULT_ACCENT,
  theme: 'system',
  incremental: true,
  verify: false,
  continueOnError: true,
  preserveMtime: true,
  sidebarOpen: true,
  lastView: 'home',
};

export function AppProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeBackups, setActiveBackups] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const { resolved: resolvedTheme } = useSystemTheme(settings.theme);

  useEffect(() => {
    (async () => {
      try {
        const [s, t, h] = await Promise.all([
          bridge.getSettings(),
          bridge.getTasks(),
          bridge.getHistory(),
        ]);
        setSettings({ ...DEFAULT_SETTINGS, ...(s || {}) });
        setTasks(Array.isArray(t) ? t : []);
        setHistory(Array.isArray(h) ? h : []);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    bridge.saveTasks(tasks);
  }, [tasks, loaded]);

  useEffect(() => {
    if (!loaded) return;
    bridge.saveHistory(history);
  }, [history, loaded]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-accent', settings.accentColor);
  }, [resolvedTheme, settings.accentColor]);

  useEffect(() => {
    const unlisten = [];
    let cancelled = false;
    (async () => {
      const offStart = await bridge.onBackupStarted((data) => {
        setActiveBackups((prev) => ({
          ...prev,
          [data.taskId]: { progress: 0, copiedBytes: 0, totalBytes: 0, copiedFiles: 0, totalFiles: 0 },
        }));
      });
      const offProgress = await bridge.onBackupProgress((data) => {
        setActiveBackups((prev) => ({ ...prev, [data.taskId]: data }));
      });
      const offComplete = await bridge.onBackupComplete((data) => {
        setActiveBackups((prev) => {
          const next = { ...prev };
          delete next[data.taskId];
          return next;
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === data.taskId && data.success
              ? { ...t, lastBackup: new Date().toISOString() }
              : t
          )
        );
        const existingTask = tasksRef.current.find((t) => t.id === data.taskId);
        setHistory((prev) => [
          {
            id: uuidv4(),
            taskId: data.taskId,
            taskName: existingTask?.name || 'Backup',
            timestamp: new Date().toISOString(),
            status: data.success ? 'success' : data.cancelled ? 'cancelled' : 'error',
            path: data.path,
            totalBytes: data.totalBytes,
            totalFiles: data.totalFiles,
            durationMs: data.durationMs,
            error: data.error,
            skipped: data.skipped,
            hardlinked: data.hardlinked,
            failed: data.failed,
            verified: data.verified,
          },
          ...prev,
        ]);
        if (data.success) {
          showToast('Backup complete');
          if (settingsRef.current.showNotifications) {
            bridge.notify('BackupDrive', `Backup of “${existingTask?.name || 'task'}” complete`);
          }
        } else if (data.cancelled) {
          showToast('Backup cancelled');
        } else {
          showToast(`Backup failed: ${data.error}`, 'error');
        }
      });
      if (cancelled) {
        offStart?.(); offProgress?.(); offComplete?.();
      } else {
        unlisten.push(offStart, offProgress, offComplete);
      }
    })();
    return () => {
      cancelled = true;
      unlisten.forEach((fn) => fn?.());
    };
  }, []);

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setConfirmState({ ...opts, resolve });
  }), []);

  const handleConfirm = useCallback((value) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  }, [confirmState]);

  const startBackup = useCallback(async (task) => {
    if (settings.confirmBeforeBackup) {
      const ok = await confirm({
        title: `Back up “${task.name}”?`,
        body: `From: ${task.source}\nTo: ${task.destination}`,
        confirmLabel: 'Start Backup',
      });
      if (!ok) return;
    }
    try {
      await bridge.startBackup(task, settings);
    } catch (e) {
      showToast(`Backup failed: ${e}`, 'error');
    }
  }, [settings, confirm, showToast]);

  const cancelBackup = useCallback(async (taskId) => {
    await bridge.cancelBackup(taskId);
  }, []);

  const addTask = useCallback((taskDraft) => {
    const dest = taskDraft.destination || settings.defaultDestination;
    if (!taskDraft.name || !taskDraft.source || !dest) return false;
    setTasks((prev) => [
      ...prev,
      { id: uuidv4(), ...taskDraft, destination: dest, lastBackup: null },
    ]);
    return true;
  }, [settings.defaultDestination]);

  const editTask = useCallback((id, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTask = useCallback(async (id) => {
    const ok = await confirm({
      title: 'Delete this task?',
      body: 'Existing backup folders will not be removed.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, [confirm]);

  const deleteHistory = useCallback((id) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const clearHistory = useCallback(async () => {
    const ok = await confirm({
      title: 'Clear all history?',
      body: 'Entries will be removed. Existing backup folders are untouched.',
      confirmLabel: 'Clear',
      danger: true,
    });
    if (!ok) return;
    setHistory([]);
  }, [confirm]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      bridge.saveSettings(next);
      return next;
    });
  }, []);

  const revealFolder = useCallback(async (folderPath) => {
    const res = await bridge.revealFolder(folderPath);
    if (!res.success) showToast(`Cannot open: ${res.error}`, 'error');
  }, [showToast]);

  const restoreBackup = useCallback(async (backupPath) => {
    const destination = await bridge.selectDirectory('Select restore destination');
    if (!destination) return;
    const ok = await confirm({
      title: 'Restore this backup?',
      body: `Files will be written to:\n${destination}`,
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    try {
      const res = await bridge.restoreBackup(backupPath, destination);
      if (res.success) {
        showToast(`Restored ${res.copiedFiles} files`);
      } else {
        showToast(`Restore failed: ${res.error}`, 'error');
      }
    } catch (e) {
      showToast(`Restore failed: ${e}`, 'error');
    }
  }, [confirm, showToast]);

  const value = {
    tasks, history, settings, activeBackups, loaded, toast, confirmState, resolvedTheme,
    startBackup, cancelBackup, addTask, editTask, deleteTask,
    deleteHistory, clearHistory, updateSetting, revealFolder, restoreBackup,
    showToast, handleConfirm, confirm,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
