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
    startBackup, cancelBackup, addTask, editTask, deleteTask, showToast,
  } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  useKeyboard(useMemo(() => [
    { key: 'n', ctrl: true, handler: () => { setEditingId(null); setShowForm((s) => !s); } },
    { key: 'Escape', handler: () => closeForm() },
  ], []));

  const editingTask = editingId ? tasks.find((t) => t.id === editingId) : null;

  return (
    <>
      <div className="section-head">
        <h2 className="title-2">Tasks</h2>
        <Button
          variant="primary"
          size="small"
          onClick={() => {
            if (showForm) { closeForm(); } else { setEditingId(null); setShowForm(true); }
          }}
        >
          {showForm ? 'Cancel' : 'New task'}
        </Button>
      </div>

      {(showForm || editingTask) && (
        <NewTaskForm
          key={editingTask ? editingTask.id : 'new'}
          initialTask={editingTask}
          onAdd={(draft) => {
            const ok = addTask(draft);
            if (ok) {
              closeForm();
              showToast('Task added');
            }
            return ok;
          }}
          onSave={(draft) => {
            editTask(editingTask.id, draft);
            closeForm();
            showToast('Task updated');
            return true;
          }}
          onCancel={closeForm}
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
              onModify={(t) => { setShowForm(false); setEditingId(t.id); }}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}
    </>
  );
}
