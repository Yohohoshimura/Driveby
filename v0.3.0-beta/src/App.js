import React, { useState, useEffect } from 'react';

const ACCENT_COLORS = {
  brick: { main: '#a83b2a', soft: '#c8472b' },
  mustard: { main: '#c89020', soft: '#e8a02f' },
  sage: { main: '#5a7a4a', soft: '#6b8e5a' },
  ink: { main: '#1a1a1a', soft: '#3a3a3a' },
  cream: { main: '#8b6f3a', soft: '#a8884a' },
};

const DEFAULT_ACCENT = ACCENT_COLORS.brick;

const DEFAULT_SETTINGS = {
  defaultDestination: '',
  compression: false,
  excludePatterns: '',
  autoCleanupDays: 0,
  confirmBeforeBackup: true,
  showNotifications: true,
  accentColor: 'brick',
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeBackups, setActiveBackups] = useState({});
  const [view, setView] = useState('home');
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', source: '', destination: '', schedule: 'manual' });
  const [loaded, setLoaded] = useState(false);

  const accent = ACCENT_COLORS[settings.accentColor] || DEFAULT_ACCENT;

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
      setSettings(s);
      setTasks(t || []);
      setHistory(h || []);
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
    if (!window.electron) return;

    window.electron.onBackupStarted((data) => {
      setActiveBackups((prev) => ({ ...prev, [data.taskId]: { progress: 0, size: '0' } }));
    });

    window.electron.onBackupProgress((data) => {
      setActiveBackups((prev) => ({
        ...prev,
        [data.taskId]: { progress: data.progress, size: data.totalSize },
      }));
    });

    window.electron.onBackupComplete((data) => {
      setActiveBackups((prev) => {
        const next = { ...prev };
        delete next[data.taskId];
        return next;
      });

      if (data.success) {
        const task = tasks.find((t) => t.id === data.taskId);
        setHistory((prev) => [{
          id: Date.now(),
          taskName: task?.name || 'Backup',
          timestamp: new Date().toISOString(),
          size: data.size,
          path: data.path,
          status: 'success',
        }, ...prev]);

        setTasks((prev) => prev.map((t) =>
          t.id === data.taskId ? { ...t, lastBackup: new Date().toISOString() } : t
        ));
      } else if (data.error) {
        setHistory((prev) => [{
          id: Date.now(),
          taskName: 'Backup',
          timestamp: new Date().toISOString(),
          status: 'error',
          error: data.error,
        }, ...prev]);
      }
    });

    return () => window.electron.removeAllListeners();
  }, [tasks]);

  const selectDirectory = async (type) => {
    if (!window.electron) return;
    const title = type === 'source' ? 'Select source folder' : 'Select destination drive';
    const path = await window.electron.selectDirectory(title);
    if (path) setNewTask((prev) => ({ ...prev, [type]: path }));
  };

  const startBackup = async (task) => {
    if (!window.electron) return;
    if (settings.confirmBeforeBackup) {
      const ok = window.confirm(`Start backup of "${task.name}"?\n\nFrom: ${task.source}\nTo: ${task.destination}`);
      if (!ok) return;
    }
    await window.electron.startBackup(task, settings);
  };

  const cancelBackup = async (taskId) => {
    if (window.electron) await window.electron.cancelBackup(taskId);
  };

  const addTask = () => {
    if (!newTask.name || !newTask.source) return;
    const dest = newTask.destination || settings.defaultDestination;
    if (!dest) {
      alert('Please select a destination or set a default in Preferences.');
      return;
    }
    setTasks([...tasks, { id: Date.now(), ...newTask, destination: dest, lastBackup: null }]);
    setNewTask({ name: '', source: '', destination: '', schedule: 'manual' });
    setShowForm(false);
  };

  const deleteTask = (id) => {
    if (!window.confirm('Delete this task?')) return;
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const deleteHistory = (id) => setHistory(history.filter((h) => h.id !== id));
  const clearHistory = () => {
    if (window.confirm('Clear all history?')) setHistory([]);
  };

  const updateSetting = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (window.electron) window.electron.saveSettings(next);
  };

  const totalBackedUp = history
    .filter((h) => h.status === 'success')
    .reduce((sum, h) => sum + parseFloat(h.size || 0), 0);

  const formatTime = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Fraunces', Georgia, serif" }}>
      <Header view={view} setView={setView} accent={accent} />

      {view === 'home' ? (
        <Home
          accent={accent}
          tasks={tasks}
          history={history}
          activeBackups={activeBackups}
          showForm={showForm}
          setShowForm={setShowForm}
          newTask={newTask}
          setNewTask={setNewTask}
          selectDirectory={selectDirectory}
          addTask={addTask}
          deleteTask={deleteTask}
          startBackup={startBackup}
          cancelBackup={cancelBackup}
          deleteHistory={deleteHistory}
          clearHistory={clearHistory}
          totalBackedUp={totalBackedUp}
          formatTime={formatTime}
          settings={settings}
        />
      ) : (
        <Settings
          settings={settings}
          updateSetting={updateSetting}
          accent={accent}
          selectDirectory={async () => {
            const p = await window.electron?.selectDirectory('Select default destination');
            if (p) updateSetting('defaultDestination', p);
          }}
        />
      )}

      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────

function Header({ view, setView, accent }) {
  const safeAccent = accent || DEFAULT_ACCENT;
  return (
    <header style={{
      borderBottom: '2px solid var(--ink)',
      padding: '24px 48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--paper)',
    }}>
      <div onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '52px',
          lineHeight: '0.9',
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}>
          BACKUP<span style={{ color: safeAccent.main }}>DRIVE</span>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginTop: '4px',
          color: 'var(--ink-soft)',
        }}>
          Est. 2026 — Issue No. 1.3
        </div>
      </div>

      <nav style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <NavButton active={view === 'home'} onClick={() => setView('home')}>
          Tasks
        </NavButton>
        <NavButton active={view === 'settings'} onClick={() => setView('settings')}>
          Preferences
        </NavButton>
      </nav>
    </header>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '20px',
        letterSpacing: '0.1em',
        color: 'var(--ink)',
        padding: '4px 0',
        borderBottom: active ? '3px solid var(--ink)' : '3px solid transparent',
        transition: 'border-color 0.2s',
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Home view
// ─────────────────────────────────────────────────────────────────

function Home(props) {
  const {
    accent, tasks, history, activeBackups, showForm, setShowForm,
    newTask, setNewTask, selectDirectory, addTask, deleteTask,
    startBackup, cancelBackup, deleteHistory, clearHistory,
    totalBackedUp, formatTime, settings,
  } = props;

  const safeAccent = accent || DEFAULT_ACCENT;

  return (
    <main style={{ padding: '48px', maxWidth: '1400px', margin: '0 auto' }}>
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0',
        borderTop: '2px solid var(--ink)',
        borderBottom: '2px solid var(--ink)',
        marginBottom: '64px',
      }}>
        <StatBlock label="Total Backed Up" value={`${totalBackedUp.toFixed(1)} MB`} accent={safeAccent} />
        <StatBlock label="Active Tasks" value={tasks.length} accent={safeAccent} bordered />
        <StatBlock label="Successful Runs" value={history.filter(h => h.status === 'success').length} accent={safeAccent} bordered />
      </section>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '64px',
          letterSpacing: '-0.01em',
          lineHeight: '1',
        }}>
          The Tasks
        </h2>
        <Button onClick={() => setShowForm(!showForm)} accent={safeAccent}>
          {showForm ? 'Cancel' : '+ New Task'}
        </Button>
      </div>

      {showForm && (
        <NewTaskForm
          newTask={newTask}
          setNewTask={setNewTask}
          selectDirectory={selectDirectory}
          addTask={addTask}
          accent={safeAccent}
          defaultDestination={settings.defaultDestination}
        />
      )}

      {tasks.length === 0 ? (
        <EmptyState text="No tasks yet. Create your first backup task above." />
      ) : (
        <div style={{ marginBottom: '64px' }}>
          {tasks.map((task, idx) => (
            <TaskCard
              key={task.id}
              task={task}
              index={idx + 1}
              backup={activeBackups[task.id]}
              startBackup={startBackup}
              cancelBackup={cancelBackup}
              deleteTask={deleteTask}
              accent={safeAccent}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '32px' }}>
            <h2 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '64px',
              letterSpacing: '-0.01em',
              lineHeight: '1',
            }}>
              The Archive
            </h2>
            <button
              onClick={clearHistory}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-soft)',
                textDecoration: 'underline',
              }}
            >
              Clear all
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid var(--ink)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ink)' }}>
                <Th>Date</Th>
                <Th>Task</Th>
                <Th>Status</Th>
                <Th align="right">Size</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px dashed var(--ink-soft)' }}>
                  <Td>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ fontWeight: 600 }}>{entry.taskName}</span>
                    {entry.path && (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                        {entry.path}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      padding: '4px 10px',
                      border: '1px solid var(--ink)',
                      background: entry.status === 'success' ? safeAccent.main : '#999',
                      color: 'var(--paper)',
                    }}>
                      {entry.status === 'success' ? '✓ OK' : '✗ ERR'}
                    </span>
                  </Td>
                  <Td align="right">
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                      {entry.size ? `${entry.size} MB` : '—'}
                    </span>
                  </Td>
                  <Td align="right">
                    {entry.path && (
                      <button
                        onClick={() => window.electron?.openFolder(entry.path)}
                        style={linkButtonStyle}
                      >
                        Open
                      </button>
                    )}
                    <button onClick={() => deleteHistory(entry.id)} style={{ ...linkButtonStyle, marginLeft: '12px' }}>
                      Delete
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

const linkButtonStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--ink)',
  textDecoration: 'underline',
  padding: '4px',
};

// ─────────────────────────────────────────────────────────────────
// Reusable bits
// ─────────────────────────────────────────────────────────────────

function StatBlock({ label, value, accent, bordered }) {
  const safeAccent = accent || DEFAULT_ACCENT;
  return (
    <div style={{
      padding: '32px 24px',
      borderLeft: bordered ? '2px solid var(--ink)' : 'none',
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        color: 'var(--ink-soft)',
        marginBottom: '12px',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '72px',
        lineHeight: '0.9',
        color: safeAccent.main,
      }}>
        {value}
      </div>
    </div>
  );
}

function Button({ children, onClick, accent, variant = 'primary', small }) {
  const safeAccent = accent || DEFAULT_ACCENT;
  const base = {
    padding: small ? '8px 16px' : '14px 28px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: small ? '14px' : '18px',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    border: '2px solid var(--ink)',
    transition: 'transform 0.1s, background 0.15s',
  };
  const variants = {
    primary: { background: 'var(--ink)', color: 'var(--paper)' },
    secondary: { background: 'var(--paper)', color: 'var(--ink)' },
    accent: { background: safeAccent.main, color: 'var(--paper)' },
    danger: { background: 'var(--paper)', color: '#a83b2a', borderColor: '#a83b2a' },
  };
  return (
    <button
      onClick={onClick}
      style={{ ...base, ...variants[variant] }}
      onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'translate(0, 0)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(0, 0)'}
    >
      {children}
    </button>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th style={{
      padding: '12px 8px',
      textAlign: align,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '0.2em',
      color: 'var(--ink-soft)',
      fontWeight: 500,
    }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }) {
  return (
    <td style={{ padding: '16px 8px', textAlign: align, verticalAlign: 'middle' }}>
      {children}
    </td>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      padding: '64px',
      textAlign: 'center',
      border: '2px dashed var(--ink)',
      marginBottom: '64px',
    }}>
      <div style={{
        fontFamily: "'Fraunces', serif",
        fontStyle: 'italic',
        fontSize: '20px',
        color: 'var(--ink-soft)',
      }}>
        {text}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// New task form
// ─────────────────────────────────────────────────────────────────

function NewTaskForm({ newTask, setNewTask, selectDirectory, addTask, accent, defaultDestination }) {
  const safeAccent = accent || DEFAULT_ACCENT;
  return (
    <div style={{
      border: '2px solid var(--ink)',
      padding: '32px',
      marginBottom: '48px',
      background: 'var(--paper-2)',
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        marginBottom: '24px',
      }}>
        New Task — Form 01
      </div>

      <FormField label="Task name">
        <input
          type="text"
          value={newTask.name}
          onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
          placeholder="e.g. Documents — April"
          style={inputStyle}
        />
      </FormField>

      <FormField label="Source folder">
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={newTask.source}
            readOnly
            placeholder="Click Browse to select..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <Button onClick={() => selectDirectory('source')} variant="secondary" small>Browse</Button>
        </div>
      </FormField>

      <FormField label={`Destination ${defaultDestination ? '(default available)' : ''}`}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={newTask.destination || defaultDestination}
            readOnly
            placeholder={defaultDestination || 'Click Browse to select...'}
            style={{ ...inputStyle, flex: 1 }}
          />
          <Button onClick={() => selectDirectory('destination')} variant="secondary" small>Browse</Button>
        </div>
      </FormField>

      <FormField label="Schedule">
        <select
          value={newTask.schedule}
          onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
          style={inputStyle}
        >
          <option value="manual">Manual</option>
          <option value="daily">Daily (planned)</option>
          <option value="weekly">Weekly (planned)</option>
          <option value="monthly">Monthly (planned)</option>
        </select>
      </FormField>

      <div style={{ marginTop: '24px' }}>
        <Button onClick={addTask} variant="accent" accent={safeAccent}>Add Task</Button>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{
        display: 'block',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        marginBottom: '8px',
        color: 'var(--ink-soft)',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontFamily: "'Fraunces', serif",
  fontSize: '16px',
  background: 'var(--paper)',
  border: '1px solid var(--ink)',
  color: 'var(--ink)',
  outline: 'none',
};

// ─────────────────────────────────────────────────────────────────
// Task card
// ─────────────────────────────────────────────────────────────────

function TaskCard({ task, index, backup, startBackup, cancelBackup, deleteTask, accent, formatTime }) {
  const isRunning = !!backup;
  const safeAccent = accent || DEFAULT_ACCENT;

  return (
    <article style={{
      borderTop: '2px solid var(--ink)',
      padding: '32px 0',
      display: 'grid',
      gridTemplateColumns: '60px 1fr auto',
      gap: '24px',
      alignItems: 'center',
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '64px',
        lineHeight: '1',
        color: safeAccent.main,
      }}>
        {String(index).padStart(2, '0')}
      </div>

      <div>
        <h3 style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 800,
          fontSize: '28px',
          marginBottom: '8px',
          lineHeight: '1.1',
        }}>
          {task.name}
        </h3>

        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          color: 'var(--ink-soft)',
          marginBottom: '4px',
        }}>
          <strong>FROM:</strong> {task.source}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          color: 'var(--ink-soft)',
          marginBottom: '12px',
        }}>
          <strong>TO:</strong> {task.destination}
        </div>

        <div style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: 'italic',
          fontSize: '13px',
          color: 'var(--ink-soft)',
        }}>
          Last backup: {formatTime(task.lastBackup)} · Schedule: {task.schedule}
        </div>

        {isRunning && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              marginBottom: '6px',
            }}>
              <span>BACKING UP — {backup.size} MB</span>
              <span style={{ fontWeight: 700 }}>{backup.progress}%</span>
            </div>
            <div style={{
              height: '8px',
              background: 'var(--paper-2)',
              border: '1px solid var(--ink)',
            }}>
              <div style={{
                height: '100%',
                width: `${backup.progress}%`,
                background: safeAccent.main,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!isRunning ? (
          <Button onClick={() => startBackup(task)} accent={safeAccent} variant="accent" small>
            ▶ Run
          </Button>
        ) : (
          <Button onClick={() => cancelBackup(task.id)} variant="danger" small>
            ■ Stop
          </Button>
        )}
        <Button onClick={() => deleteTask(task.id)} variant="secondary" small>
          Delete
        </Button>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────
// Settings view
// ─────────────────────────────────────────────────────────────────

function Settings({ settings, updateSetting, accent, selectDirectory }) {
  const safeAccent = accent || DEFAULT_ACCENT;
  return (
    <main style={{ padding: '48px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '120px',
          lineHeight: '0.9',
          letterSpacing: '-0.02em',
          marginBottom: '16px',
        }}>
          Preferences
        </h1>
        <p style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: 'italic',
          fontSize: '20px',
          color: 'var(--ink-soft)',
          maxWidth: '600px',
        }}>
          Tune the machinery. Settings save automatically and persist between sessions.
        </p>
      </div>

      <SettingsSection title="01 — Defaults" accent={safeAccent}>
        <SettingRow
          label="Default destination"
          help="Pre-fills the destination when creating a new task."
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={settings.defaultDestination}
              readOnly
              placeholder="No default set"
              style={{ ...inputStyle, flex: 1 }}
            />
            <Button onClick={selectDirectory} variant="secondary" small>Browse</Button>
            {settings.defaultDestination && (
              <Button onClick={() => updateSetting('defaultDestination', '')} variant="danger" small>Clear</Button>
            )}
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="02 — Backup Behaviour" accent={safeAccent}>
        <SettingRow
          label="Confirm before each backup"
          help="Show a confirmation dialog before starting any backup."
        >
          <Toggle value={settings.confirmBeforeBackup} onChange={(v) => updateSetting('confirmBeforeBackup', v)} accent={safeAccent} />
        </SettingRow>

        <SettingRow
          label="Show OS notifications"
          help="Native desktop notification when a backup completes."
        >
          <Toggle value={settings.showNotifications} onChange={(v) => updateSetting('showNotifications', v)} accent={safeAccent} />
        </SettingRow>

        <SettingRow
          label="Compression"
          help="Reserved for future ZIP archive support."
        >
          <Toggle value={settings.compression} onChange={(v) => updateSetting('compression', v)} accent={safeAccent} disabled />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="03 — Filtering" accent={safeAccent}>
        <SettingRow
          label="Exclude patterns"
          help="Comma-separated glob patterns. Examples: *.tmp, node_modules, .git, *.log"
        >
          <input
            type="text"
            value={settings.excludePatterns}
            onChange={(e) => updateSetting('excludePatterns', e.target.value)}
            placeholder="*.tmp, node_modules, .DS_Store"
            style={inputStyle}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="04 — Maintenance" accent={safeAccent}>
        <SettingRow
          label="Auto-cleanup old backups"
          help="Delete backups older than N days from destination after each run. 0 = disabled."
        >
          <input
            type="number"
            min="0"
            max="365"
            value={settings.autoCleanupDays}
            onChange={(e) => updateSetting('autoCleanupDays', parseInt(e.target.value) || 0)}
            style={{ ...inputStyle, width: '120px' }}
          />
          <span style={{
            marginLeft: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: 'var(--ink-soft)',
          }}>
            DAYS
          </span>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="05 — Appearance" accent={safeAccent}>
        <SettingRow
          label="Accent colour"
          help="Pick the accent used throughout the interface."
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.entries(ACCENT_COLORS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => updateSetting('accentColor', key)}
                style={{
                  padding: '12px 20px',
                  background: val.main,
                  color: 'var(--paper)',
                  border: settings.accentColor === key ? '3px solid var(--ink)' : '2px solid var(--ink)',
                  cursor: 'pointer',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '14px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingsSection>
    </main>
  );
}

function SettingsSection({ title, children, accent }) {
  const safeAccent = accent || DEFAULT_ACCENT;
  return (
    <section style={{ marginBottom: '64px' }}>
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '32px',
        letterSpacing: '0.05em',
        borderBottom: '2px solid var(--ink)',
        paddingBottom: '12px',
        marginBottom: '24px',
        color: safeAccent.main,
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SettingRow({ label, help, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '32px',
      padding: '20px 0',
      borderBottom: '1px dashed var(--ink-soft)',
      alignItems: 'start',
    }}>
      <div>
        <div style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 600,
          fontSize: '17px',
          marginBottom: '4px',
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: 'italic',
          fontSize: '13px',
          color: 'var(--ink-soft)',
          lineHeight: '1.4',
        }}>
          {help}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange, accent, disabled }) {
  const safeAccent = accent || DEFAULT_ACCENT;
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: '60px',
        height: '32px',
        background: value ? safeAccent.main : 'var(--paper-2)',
        border: '2px solid var(--ink)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        position: 'relative',
        padding: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '2px',
        left: value ? '30px' : '2px',
        width: '24px',
        height: '24px',
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        transition: 'left 0.15s',
      }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      borderTop: '2px solid var(--ink)',
      padding: '24px 48px',
      marginTop: '64px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'var(--paper-2)',
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: 'var(--ink-soft)',
      }}>
        BackupDrive · v1.3.0
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: 'var(--ink-soft)',
      }}>
        MIT License
      </div>
    </footer>
  );
}
