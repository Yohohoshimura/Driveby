import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Button from './common/Button';
import EmptyState from './common/EmptyState';
import TaskCard from './TaskCard';
import NewTaskForm from './NewTaskForm';
import History from './History';
import { formatBytes } from '../lib/format';
import { useKeyboard } from '../hooks/useKeyboard';

export default function Home() {
  const {
    tasks, history, activeBackups, settings,
    startBackup, cancelBackup, addTask, deleteTask, showToast,
  } = useApp();
  const [showForm, setShowForm] = useState(false);

  useKeyboard(useMemo(() => [
    { key: 'n', ctrl: true, handler: () => setShowForm((s) => !s) },
    { key: 'Escape', handler: () => setShowForm(false) },
  ], []));

  const totalBackedUp = history
    .filter((h) => h.status === 'success')
    .reduce((sum, h) => sum + (h.totalBytes || 0), 0);

  return (
    <>
      <div className="page-head">
        <h1 className="title-1">Backups</h1>
        <p className="subhead">Manage and run backup tasks to any local drive.</p>
      </div>

      <section className="stats" aria-label="Statistics">
        <div className="stat">
          <div className="stat__label">Total Backed Up</div>
          <div className="stat__value">{formatBytes(totalBackedUp)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Tasks</div>
          <div className="stat__value">{tasks.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Successful Runs</div>
          <div className="stat__value">{history.filter((h) => h.status === 'success').length}</div>
        </div>
      </section>

      <div className="section-head">
        <h2 className="title-2">Tasks</h2>
        <Button variant="primary" size="small" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Task'}
        </Button>
      </div>

      {showForm && (
        <NewTaskForm
          onAdd={(draft) => {
            const ok = addTask(draft);
            if (ok) {
              setShowForm(false);
              showToast('Task added');
            }
            return ok;
          }}
          onCancel={() => setShowForm(false)}
          defaultDestination={settings.defaultDestination}
          showToast={showToast}
        />
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="No backup tasks"
          hint="Press ⌘N or tap + New Task to create one."
        />
      ) : (
        <div className="group" role="list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              backup={activeBackups[task.id]}
              onRun={startBackup}
              onCancel={cancelBackup}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}

      <History />
    </>
  );
}
