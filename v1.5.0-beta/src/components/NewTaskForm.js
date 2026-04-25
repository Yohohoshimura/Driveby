import React, { useState } from 'react';
import Button from './common/Button';
import FormField from './common/FormField';

const INITIAL = { name: '', source: '', destination: '', schedule: 'manual' };

export default function NewTaskForm({ onAdd, onCancel, defaultDestination, showToast }) {
  const [task, setTask] = useState(INITIAL);
  const [dragTarget, setDragTarget] = useState(null);

  const pick = async (type) => {
    if (!window.electron) return;
    const title = type === 'source' ? 'Select source folder' : 'Select destination';
    const p = await window.electron.selectDirectory(title);
    if (p) setTask((prev) => ({ ...prev, [type]: p }));
  };

  const handleDrop = (type) => (e) => {
    e.preventDefault();
    setDragTarget(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.path) return showToast?.('Drag-and-drop unavailable — use Choose', 'error');
    setTask((prev) => ({ ...prev, [type]: file.path }));
  };

  const submit = () => {
    if (!task.name.trim()) return showToast?.('Task name required', 'error');
    if (!task.source) return showToast?.('Source folder required', 'error');
    if (!task.destination && !defaultDestination) {
      return showToast?.('Destination required', 'error');
    }
    const ok = onAdd(task);
    if (ok) setTask(INITIAL);
  };

  return (
    <div className="card">
      <div className="card__head">New Task</div>

      <FormField label="Name" htmlFor="task-name">
        <input
          id="task-name"
          type="text"
          className="field"
          value={task.name}
          onChange={(e) => setTask({ ...task, name: e.target.value })}
          placeholder="Documents — April"
          autoFocus
        />
      </FormField>

      <FormField label="Source" hint="Drag a folder here or choose one">
        <div
          className={`field-row ${dragTarget === 'source' ? 'field-row--drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragTarget('source'); }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={handleDrop('source')}
        >
          <input className="field field--readonly" readOnly value={task.source} placeholder="Choose folder…" />
          <Button size="small" onClick={() => pick('source')}>Choose…</Button>
        </div>
      </FormField>

      <FormField label={`Destination${defaultDestination ? ' (default available)' : ''}`}>
        <div
          className={`field-row ${dragTarget === 'destination' ? 'field-row--drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragTarget('destination'); }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={handleDrop('destination')}
        >
          <input
            className="field field--readonly"
            readOnly
            value={task.destination || defaultDestination}
            placeholder={defaultDestination || 'Choose folder…'}
          />
          <Button size="small" onClick={() => pick('destination')}>Choose…</Button>
        </div>
      </FormField>

      <FormField label="Schedule" hint="Automatic runs require BackupDrive to be open">
        <select
          className="field"
          value={task.schedule}
          onChange={(e) => setTask({ ...task, schedule: e.target.value })}
        >
          <option value="manual">Manual</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </FormField>

      <div className="card__actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={submit}>Add Task</Button>
      </div>
    </div>
  );
}
