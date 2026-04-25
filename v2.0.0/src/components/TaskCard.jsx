import React from 'react';
import Button from './common/Button';
import { formatTime, formatBytes } from '../lib/format';

export default function TaskCard({ task, backup, onRun, onCancel, onDelete }) {
  const isRunning = !!backup;
  return (
    <article className="task">
      <div className="task__body">
        <div className="task__name">{task.name}</div>
        <div className="task__paths" title={`${task.source} → ${task.destination}`}>
          {task.source} → {task.destination}
        </div>
        <div className="task__meta">
          Last run {formatTime(task.lastBackup)} · {task.schedule === 'manual' ? 'Manual' : task.schedule}
        </div>

        {isRunning && (
          <div className="task__progress" aria-live="polite">
            <div className="task__progress-row">
              <span>
                {backup.copiedFiles || 0} / {backup.totalFiles || 0} files · {formatBytes(backup.copiedBytes || 0)} of {formatBytes(backup.totalBytes || 0)}
              </span>
              <span>{backup.progress || 0}%</span>
            </div>
            <div
              className="progressbar"
              role="progressbar"
              aria-valuenow={backup.progress || 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progressbar__fill" style={{ width: `${backup.progress || 0}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="task__actions">
        {!isRunning ? (
          <Button variant="primary" size="small" onClick={() => onRun(task)} ariaLabel={`Run ${task.name}`}>
            Back up
          </Button>
        ) : (
          <Button size="small" destructive onClick={() => onCancel(task.id)} ariaLabel={`Cancel ${task.name}`}>
            Stop
          </Button>
        )}
        <Button size="small" variant="borderless" onClick={() => onDelete(task.id)} ariaLabel={`Delete ${task.name}`}>
          Delete
        </Button>
      </div>
    </article>
  );
}
