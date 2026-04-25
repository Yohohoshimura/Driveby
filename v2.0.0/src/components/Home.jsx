import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Button from './common/Button';
import EmptyState from './common/EmptyState';
import TaskCard from './TaskCard';
import NewTaskForm from './NewTaskForm';
import { useKeyboard } from '../hooks/useKeyboard';

export default function Home() {
  const {
    tasks, activeBackups, settings,
    startBackup, cancelBackup, addTask, deleteTask, showToast,
  } = useApp();
  const [showForm, setShowForm] = useState(false);

  useKeyboard(useMemo(() => [
    { key: 'n', ctrl: true, handler: () => setShowForm((s) => !s) },
    { key: 'Escape', handler: () => setShowForm(false) },
  ], []));

  return (
    <>
      <div className="section-head">
        <h2 className="title-2">Tasks</h2>
        <Button variant="primary" size="small" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New task'}
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
        <EmptyState title="Empty" />
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
    </>
  );
}
