import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Play, Pause, CheckCircle, AlertCircle, Clock, FolderOpen,
  HardDrive, Settings, ChevronRight, MoreVertical, Zap, TrendingUp
} from 'lucide-react';

export default function BackupApp() {
  const [tasks, setTasks] = useState([]);
  const [activeBackups, setActiveBackups] = useState(new Map());
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', source: '', destination: '', schedule: 'manual' });
  const [loading, setLoading] = useState({});
  const [stats, setStats] = useState({ totalSize: '0 GB', lastBackup: 'Jamais', backupsCount: 0 });

  // Initialiser les listeners Electron
  useEffect(() => {
    if (window.electron) {
      window.electron.onBackupProgress((data) => {
        setActiveBackups(prev => new Map(prev).set(data.backupId, {
          progress: data.progress,
          size: data.totalSize,
        }));
      });

      window.electron.onBackupComplete((data) => {
        if (data.success) {
          const taskId = data.backupId;
          setHistory(prev => [{
            id: Date.now(),
            taskName: 'Backup',
            timestamp: new Date().toLocaleString('fr-FR'),
            size: data.size,
            status: 'success',
            path: data.path,
          }, ...prev]);

          setStats(prev => ({
            ...prev,
            totalSize: (parseFloat(prev.totalSize) + parseFloat(data.size)).toFixed(1) + ' GB',
            lastBackup: new Date().toLocaleString('fr-FR'),
            backupsCount: prev.backupsCount + 1,
          }));
        }

        setActiveBackups(prev => {
          const updated = new Map(prev);
          updated.delete(data.backupId);
          return updated;
        });
      });
    }

    return () => {
      if (window.electron) {
        window.electron.removeBackupProgressListener();
        window.electron.removeBackupCompleteListener();
      }
    };
  }, []);

  const selectDirectory = useCallback(async (type) => {
    if (!window.electron) return;

    const title = type === 'source' ? 'Sélectionner le dossier à sauvegarder' : 'Sélectionner le drive de destination';
    const path = await window.electron.selectDirectory(title);

    if (path) {
      setNewTask(prev => ({
        ...prev,
        [type]: path,
      }));
    }
  }, []);

  const startBackup = async (task) => {
    if (!window.electron) return;

    const backupId = task.id;
    setLoading(prev => ({ ...prev, [backupId]: true }));

    try {
      await window.electron.startBackup(task);
    } catch (error) {
      console.error('Erreur backup:', error);
    } finally {
      setLoading(prev => ({ ...prev, [backupId]: false }));
    }
  };

  const cancelBackup = async (backupId) => {
    if (window.electron) {
      await window.electron.cancelBackup(backupId);
    }
  };

  const addTask = () => {
    if (newTask.name && newTask.source && newTask.destination) {
      const task = {
        id: Date.now(),
        ...newTask,
        lastBackup: 'Jamais',
        status: 'ready',
      };
      setTasks([...tasks, task]);
      setNewTask({ name: '', source: '', destination: '', schedule: 'manual' });
      setShowForm(false);
    }
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const deleteHistory = (id) => {
    setHistory(history.filter(h => h.id !== id));
  };

  const isBackupRunning = (taskId) => {
    return Array.from(activeBackups.entries()).some(([, backup]) => backup.taskId === taskId);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #eef2f5 100%)' }}>
      {/* Barre de titre élégante */}
      <div className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <HardDrive className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent" style={{ fontFamily: 'Outfit, sans-serif' }}>
                BackupDrive
              </h1>
              <p className="text-xs text-gray-500 font-medium tracking-wide">Sauvegardez en toute confiance</p>
            </div>
          </div>
          <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors duration-200">
            <Settings className="w-5 h-5 text-gray-600" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-2">Total sauvegardé</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalSize}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-emerald-500/20" />
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-2">Dernière sauvegarde</p>
                <p className="text-sm font-semibold text-gray-900">{stats.lastBackup}</p>
              </div>
              <Clock className="w-12 h-12 text-blue-500/20" />
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-2">Sauvegardes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.backupsCount}</p>
              </div>
              <Zap className="w-12 h-12 text-amber-500/20" />
            </div>
          </div>
        </div>

        {/* Bouton principal */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="mb-8 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl active:scale-95"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          Nouvelle tâche
        </button>

        {/* Formulaire */}
        {showForm && (
          <div className="mb-8 p-8 bg-white rounded-2xl border border-gray-200/50 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Créer une nouvelle sauvegarde
            </h2>

            <div className="space-y-5 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nom de la sauvegarde</label>
                <input
                  type="text"
                  placeholder="Ex: Documents importants"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dossier à sauvegarder</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Cliquez sur Parcourir"
                    value={newTask.source}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none"
                  />
                  <button
                    onClick={() => selectDirectory('source')}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                  >
                    Parcourir
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Drive de destination</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Cliquez sur Parcourir"
                    value={newTask.destination}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none"
                  />
                  <button
                    onClick={() => selectDirectory('destination')}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                  >
                    Parcourir
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Planification</label>
                <select
                  value={newTask.schedule}
                  onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all duration-200"
                >
                  <option value="manual">Manuel</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={addTask}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors duration-200"
              >
                Ajouter
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors duration-200"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Tâches */}
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Tâches de sauvegarde
          </h2>

          {tasks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200/50 shadow-sm">
              <FolderOpen className="w-14 h-14 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-gray-400 font-medium">Aucune tâche. Créez votre première sauvegarde.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map(task => {
                const backup = Array.from(activeBackups.values()).find(b => b.taskId === task.id);
                const progress = backup?.progress || 0;

                return (
                  <div
                    key={task.id}
                    className="p-6 bg-white rounded-xl border border-gray-200/50 hover:border-emerald-300/50 hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-3">{task.name}</h3>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-gray-400" strokeWidth={2} />
                            <span>{task.source}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-gray-400" strokeWidth={2} />
                            <span>{task.destination}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition-all duration-200"
                      >
                        <Trash2 className="w-5 h-5" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Barre de progression */}
                    {backup && (
                      <div className="mb-5 pt-4 border-t border-gray-100">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600 font-medium">Progression</span>
                          <span className="text-emerald-600 font-bold">{progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{backup.size} MB</p>
                      </div>
                    )}

                    {/* Boutons */}
                    <div className="flex gap-3">
                      {!backup ? (
                        <button
                          onClick={() => startBackup(task)}
                          disabled={loading[task.id]}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50"
                        >
                          <Play className="w-4 h-4" strokeWidth={2.5} />
                          Lancer
                        </button>
                      ) : (
                        <button
                          onClick={() => cancelBackup(task.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-semibold transition-colors duration-200"
                        >
                          <Pause className="w-4 h-4" strokeWidth={2.5} />
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Historique
            </h2>
            <div className="space-y-3">
              {history.map(entry => (
                <div
                  key={entry.id}
                  className="p-5 bg-white rounded-xl border border-gray-200/50 hover:border-emerald-300/50 hover:shadow-md transition-all duration-300 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" strokeWidth={2.5} />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-semibold text-sm">{entry.taskName}</p>
                      <p className="text-gray-500 text-xs">{entry.timestamp}</p>
                      <p className="text-gray-400 text-xs truncate">{entry.path}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-gray-900 font-bold text-sm">{entry.size} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteHistory(entry.id)}
                    className="ml-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        
        * {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
        }

        button:focus {
          outline: none;
        }

        input:focus,
        select:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
