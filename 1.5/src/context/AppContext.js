import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
};

export function AppProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeBackups, setActiveBackups] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const { resolved: resolvedTheme } = useSystemTheme(settings.theme);

  useEffect(() => {
    (async () => {
      if (!window.electron) {
        setLoaded(true);
        return;
      }
      const [s, t, h] = await Promise.all([
        window.electron.getSettings(),
        window.electron.getTasks(),
        window.electron.getHistory(),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setTasks(Array.isArray(t) ? t : []);
      setHistory(Array.isArray(h) ? h : []);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !window.electron) return;
    window.electron.saveTasks(tasks);
  }, [tasks, loaded]);

  useEffect(() => {
    if (!loaded || !window.electron) return;
    window.electron.saveHistory(history);
  }, [history, loaded]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-accent', settings.accentColor);
    if (window.electron?.setThemeSource) window.electron.setThemeSource(settings.theme);
  }, [resolvedTheme, settings.accentColor, settings.theme]);

  useEffect(() => {
    if (!window.electron) return;
    const offStart = window.electron.onBackupStarted((data) => {
      setActiveBackups((prev) => ({
        ...prev,
        [data.taskId]: { progress: 0, copiedBytes: 0, totalBytes: 0, copiedFiles: 0, totalFiles: 0 },
      }));
    });
    const offProgress = window.electron.onBackupProgress((data) => {
      setActiveBackups((prev) => ({ ...prev, [data.taskId]: data }));
    });
    const offComplete = window.electron.onBackupComplete((data) => {
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
      setHistory((prev) => {
        const existingTask = (window.__lastTasksSnapshot || []).find((t) => t.id === data.taskId);
        return [
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
          },
          ...prev,
        ];
      });
      if (data.success) showToast('Backup complete');
      else if (data.cancelled) showToast('Backup cancelled');
      else showToast(`Backup failed: ${data.error}`, 'error');
    });
    return () => {
      offStart?.();
      offProgress?.();
      offComplete?.();
    };
  }, []);

  useEffect(() => {
    window.__lastTasksSnapshot = tasks;
  }, [tasks]);

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
    if (!window.electron) return;
    if (settings.confirmBeforeBackup) {
      const ok = await confirm({
        title: `Back up “${task.name}”?`,
        body: `From: ${task.source}\nTo: ${task.destination}`,
        confirmLabel: 'Start Backup',
      });
      if (!ok) return;
    }
    await window.electron.startBackup(task, settings);
  }, [settings, confirm]);

  const cancelBackup = useCallback(async (taskId) => {
    if (window.electron) await window.electron.cancelBackup(taskId);
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
      if (window.electron) window.electron.saveSettings(next);
      return next;
    });
  }, []);

  const revealFolder = useCallback(async (folderPath) => {
    if (!window.electron) return;
    const res = await window.electron.revealFolder(folderPath);
    if (!res.success) showToast(`Cannot open: ${res.error}`, 'error');
  }, [showToast]);

  const value = {
    tasks, history, settings, activeBackups, loaded, toast, confirmState, resolvedTheme,
    startBackup, cancelBackup, addTask, deleteTask,
    deleteHistory, clearHistory, updateSetting, revealFolder,
    showToast, handleConfirm,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
