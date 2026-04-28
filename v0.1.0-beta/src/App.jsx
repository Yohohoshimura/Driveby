import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Play, Pause, CheckCircle, Clock, FolderOpen, HardDrive, Settings, TrendingUp, Zap
} from 'lucide-react';

export default function BackupApp() {
  const [tasks, setTasks] = useState([]);
  const [activeBackups, setActiveBackups] = useState(new Map());
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', source: '', destination: '', schedule: 'manual' });
  const [loading, setLoading] = useState({});
  const [stats, setStats] = useState({ totalSize: '0 GB', lastBackup: 'Never', backupsCount: 0 });

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
          setHistory(prev => [{
            id: Date.now(),
            taskName: 'Backup',
            timestamp: new Date().toLocaleString(),
            size: data.size,
            status: 'success',
            path: data.path,
          }, ...prev]);

          setStats(prev => ({
            ...prev,
            totalSize: (parseFloat(prev.totalSize) + parseFloat(data.size)).toFixed(1) + ' GB',
            lastBackup: new Date().toLocaleString(),
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

  const selectDirectory = async (type) => {
    if (!window.electron) return;
    const title = type === 'source' ? 'Select folder to backup' : 'Select backup destination';
    const path = await window.electron.selectDirectory(title);

    if (path) {
      setNewTask(prev => ({
        ...prev,
        [type]: path,
      }));
    }
  };

  const startBackup = async (task) => {
    if (!window.electron) return;
    setLoading(prev => ({ ...prev, [task.id]: true }));

    try {
      await window.electron.startBackup(task);
    } catch (error) {
      console.error('Backup error:', error);
    } finally {
      setLoading(prev => ({ ...prev, [task.id]: false }));
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
        lastBackup: 'Never',
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

  return (
    <div style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #eef2f5 100%)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e5e7eb', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'linear-gradient(to right, #10b981, #0d9488)', borderRadius: '8px' }}>
              <HardDrive style={{ width: '20px', height: '20px', color: 'white' }} strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#111' }}>BackupDrive</h1>
              <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0', fontWeight: '500' }}>Reliable backups</p>
            </div>
          </div>
          <button style={{ padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Settings style={{ width: '20px', height: '20px', color: '#999' }} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '48px' }}>
          <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '0.5px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#999', fontSize: '12px', fontWeight: '500', margin: '0 0 8px' }}>Total backed up</p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#111', margin: 0 }}>{stats.totalSize}</p>
              </div>
              <TrendingUp style={{ width: '48px', height: '48px', color: '#10b981', opacity: 0.2 }} />
            </div>
          </div>

          <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '0.5px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#999', fontSize: '12px', fontWeight: '500', margin: '0 0 8px' }}>Last backup</p>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#111', margin: 0 }}>{stats.lastBackup}</p>
              </div>
              <Clock style={{ width: '48px', height: '48px', color: '#3b82f6', opacity: 0.2 }} />
            </div>
          </div>

          <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '0.5px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#999', fontSize: '12px', fontWeight: '500', margin: '0 0 8px' }}>Total backups</p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#111', margin: 0 }}>{stats.backupsCount}</p>
              </div>
              <Zap style={{ width: '48px', height: '48px', color: '#f59e0b', opacity: 0.2 }} />
            </div>
          </div>
        </div>

        {/* New Task Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            marginBottom: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'linear-gradient(to right, #10b981, #0d9488)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 10px 25px rgba(16,185,129,0.2)',
          }}
          onMouseOver={(e) => { e.target.style.transform = 'scale(1.05)'; }}
          onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
        >
          <Plus style={{ width: '20px', height: '20px' }} strokeWidth={2.5} />
          New Task
        </button>

        {/* Form */}
        {showForm && (
          <div style={{ marginBottom: '32px', padding: '32px', background: 'white', border: '0.5px solid #e5e7eb', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111', marginBottom: '24px' }}>Create backup task</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Task name (e.g. Documents)"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                style={{ padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Source folder"
                  value={newTask.source}
                  readOnly
                  style={{ flex: 1, padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                />
                <button
                  onClick={() => selectDirectory('source')}
                  style={{ padding: '12px 24px', background: '#f3f4f6', hover: '#e5e7eb', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
                >
                  Browse
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Destination folder"
                  value={newTask.destination}
                  readOnly
                  style={{ flex: 1, padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                />
                <button
                  onClick={() => selectDirectory('destination')}
                  style={{ padding: '12px 24px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
                >
                  Browse
                </button>
              </div>
              <select
                value={newTask.schedule}
                onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                style={{ padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={addTask}
                style={{ padding: '12px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Add
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: '12px 24px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tasks */}
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#111', marginBottom: '20px' }}>Backup Tasks</h2>

        {tasks.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', background: 'white', borderRadius: '16px', border: '0.5px solid #e5e7eb' }}>
            <FolderOpen style={{ width: '56px', height: '56px', color: '#d1d5db', margin: '0 auto 16px' }} strokeWidth={1.5} />
            <p style={{ color: '#999', fontWeight: '500' }}>No tasks. Create one to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {tasks.map(task => {
              const backup = Array.from(activeBackups.values()).find(b => b.taskId === task.id);
              const progress = backup?.progress || 0;

              return (
                <div
                  key={task.id}
                  style={{
                    padding: '24px',
                    background: 'white',
                    border: '0.5px solid #e5e7eb',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#111', marginBottom: '12px' }}>{task.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        <FolderOpen style={{ width: '16px', height: '16px' }} strokeWidth={2} />
                        {task.source}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666' }}>
                        <HardDrive style={{ width: '16px', height: '16px' }} strokeWidth={2} />
                        {task.destination}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                    >
                      <Trash2 style={{ width: '20px', height: '20px' }} strokeWidth={2} />
                    </button>
                  </div>

                  {backup && (
                    <div style={{ marginBottom: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                        <span style={{ color: '#666', fontWeight: '500' }}>Progress</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>{progress}%</span>
                      </div>
                      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            background: 'linear-gradient(to right, #10b981, #0d9488)',
                            width: `${progress}%`,
                            transition: 'width 0.3s',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: '#999', margin: '8px 0 0' }}>{backup.size} MB</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {!backup ? (
                      <button
                        onClick={() => startBackup(task)}
                        disabled={loading[task.id]}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          background: '#d1fae5',
                          color: '#047857',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          opacity: loading[task.id] ? 0.5 : 1,
                        }}
                      >
                        <Play style={{ width: '16px', height: '16px' }} strokeWidth={2.5} />
                        Start
                      </button>
                    ) : (
                      <button
                        onClick={() => cancelBackup(task.id)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          background: '#fef3c7',
                          color: '#b45309',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <Pause style={{ width: '16px', height: '16px' }} strokeWidth={2.5} />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: '48px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#111', marginBottom: '20px' }}>History</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {history.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    padding: '16px',
                    background: 'white',
                    border: '0.5px solid #e5e7eb',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <CheckCircle style={{ width: '20px', height: '20px', color: '#10b981' }} strokeWidth={2.5} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', color: '#111', fontWeight: '600', margin: 0 }}>{entry.taskName}</p>
                      <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>{entry.timestamp}</p>
                      <p style={{ fontSize: '11px', color: '#ccc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.path}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '13px', color: '#111', fontWeight: 'bold', margin: 0 }}>{entry.size} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteHistory(entry.id)}
                    style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#999', marginLeft: '16px' }}
                  >
                    <Trash2 style={{ width: '16px', height: '16px' }} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
