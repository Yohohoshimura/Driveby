import React from 'react';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      className={`toast ${toast.kind === 'error' ? 'toast--error' : ''}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
