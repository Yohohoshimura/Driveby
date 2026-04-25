import React from 'react';
import { formatTime } from '../../lib/format';

export default function TaskList({ tasks }) {
  if (!tasks || tasks.length === 0) {
    return <div className="chart-empty">No tasks</div>;
  }
  return (
    <div className="task-list-stat">
      <ul className="task-list-stat__items" role="list">
        {tasks.map((t) => (
          <li key={t.id} className="task-list-stat__item">
            <div className="task-list-stat__name">{t.name}</div>
            <div className="task-list-stat__meta" title={`${t.source} → ${t.destination}`}>
              {t.source} → {t.destination}
            </div>
            <div className="task-list-stat__sub">
              Last run {formatTime(t.lastBackup)} · {t.schedule || 'manual'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
