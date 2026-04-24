import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatTime, formatBytes, formatDuration } from '../lib/format';
import Button from './common/Button';
import EmptyState from './common/EmptyState';

export default function History() {
  const { history, deleteHistory, clearHistory, revealFolder } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    return history.filter((h) => {
      if (filter !== 'all' && h.status !== filter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        h.taskName?.toLowerCase().includes(q) ||
        h.path?.toLowerCase().includes(q) ||
        h.error?.toLowerCase().includes(q)
      );
    });
  }, [history, query, filter]);

  if (history.length === 0) return <EmptyState title="Empty" />;

  return (
    <section>
      <div className="section-head">
        <h2 className="title-2">History</h2>
        <Button size="small" variant="borderless" onClick={clearHistory}>Clear All</Button>
      </div>

      <div className="history-toolbar">
        <input
          className="field field--compact"
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search history"
        />
        <select
          className="field field--compact"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter status"
          style={{ width: 120 }}
        >
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="error">Errors</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Task</th>
            <th>Status</th>
            <th className="th--right">Size</th>
            <th className="th--right">Files</th>
            <th className="th--right">Duration</th>
            <th className="th--right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((entry) => (
            <tr key={entry.id}>
              <td><span className="mono">{formatTime(entry.timestamp)}</span></td>
              <td>
                <div className="history-task-name">{entry.taskName}</div>
                {entry.path && <div className="history-path" title={entry.path}>{entry.path}</div>}
                {entry.error && <div className="history-path" style={{ color: 'var(--system-red)' }}>{entry.error}</div>}
              </td>
              <td>
                <span className={`badge badge--${entry.status}`}>
                  {entry.status === 'success' ? 'Success' : entry.status === 'cancelled' ? 'Cancelled' : 'Error'}
                </span>
              </td>
              <td className="td--right"><span className="mono">{entry.totalBytes ? formatBytes(entry.totalBytes) : '—'}</span></td>
              <td className="td--right"><span className="mono">{entry.totalFiles ?? '—'}</span></td>
              <td className="td--right"><span className="mono">{entry.durationMs ? formatDuration(Math.round(entry.durationMs / 1000)) : '—'}</span></td>
              <td className="td--right">
                {entry.path && (
                  <Button size="small" variant="borderless" onClick={() => revealFolder(entry.path)}>Reveal</Button>
                )}
                <Button size="small" variant="borderless" onClick={() => deleteHistory(entry.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
