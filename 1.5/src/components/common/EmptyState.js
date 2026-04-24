import React from 'react';

export default function EmptyState({ title, hint, action }) {
  return (
    <div className="empty">
      {title && <div className="empty__title">{title}</div>}
      {hint && <div className="empty__hint">{hint}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
