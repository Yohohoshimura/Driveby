import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Button from './common/Button';
import EmptyState from './common/EmptyState';
import TaskCard from './TaskCard';
import NewTaskForm from './NewTaskForm';
import PieChart from './charts/PieChart';
import ProcessCycle from './charts/ProcessCycle';
import Speedometer from './charts/Speedometer';
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

  const successBytes = history.filter((h) => h.status === 'success').reduce((s, h) => s + (h.totalBytes || 0), 0);
  const failedBytes = history.filter((h) => h.status === 'error').reduce((s, h) => s + (h.totalBytes || 0), 0);
  const cancelledBytes = history.filter((h) => h.status === 'cancelled').reduce((s, h) => s + (h.totalBytes || 0), 0);
  const successRuns = history.filter((h) => h.status === 'success').length;
  const totalRuns = history.length;

  return (
    <>
      <section className="stats" aria-label="Statistics">
        <div className="stat">
          <div className="stat__head">Total Backed Up</div>
          <PieChart
            slices={[
              { value: successBytes, color: 'var(--accent)' },
              { value: failedBytes, color: 'var(--system-red)' },
              { value: cancelledBytes, color: 'var(--system-gray)' },
            ]}
            centerValue={successBytes > 0 ? formatBytes(successBytes) : '0'}
          />
        </div>
        <div className="stat">
          <div className="stat__head">Tasks</div>
          <ProcessCycle count={tasks.length} centerLabel="Active" />
        </div>
        <div className="stat">
          <div className="stat__head">Successful Runs</div>
          <Speedometer successes={successRuns} failures={totalRuns - successRuns} />
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
