import React, { useEffect, useRef } from 'react';
import Button from './common/Button';

export default function ConfirmDialog({ state, onResolve }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!state) return;
    dialogRef.current?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') onResolve(false);
      if (e.key === 'Enter') onResolve(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, onResolve]);

  if (!state) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal__backdrop" onClick={() => onResolve(false)} />
      <div className="modal__content" ref={dialogRef} tabIndex={-1}>
        <h2 id="confirm-title" className="modal__title">{state.title}</h2>
        <p className="modal__body">{state.body}</p>
        <div className="modal__actions">
          <Button onClick={() => onResolve(false)}>Cancel</Button>
          <Button
            variant="primary"
            destructive={state.danger}
            onClick={() => onResolve(true)}
          >
            {state.confirmLabel || 'OK'}
          </Button>
        </div>
      </div>
    </div>
  );
}
