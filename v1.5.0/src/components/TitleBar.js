import React from 'react';

export default function TitleBar({ view, setView, rightSlot }) {
  return (
    <div className="titlebar">
      <div className="titlebar__left" />

      <div className="segmented" role="tablist" aria-label="View">
        <button
          role="tab"
          aria-selected={view === 'home'}
          className={`segmented__btn ${view === 'home' ? 'segmented__btn--active' : ''}`}
          onClick={() => setView('home')}
        >
          Tasks
        </button>
        <button
          role="tab"
          aria-selected={view === 'settings'}
          className={`segmented__btn ${view === 'settings' ? 'segmented__btn--active' : ''}`}
          onClick={() => setView('settings')}
        >
          Preferences
        </button>
      </div>

      <div className="titlebar__right">{rightSlot}</div>
    </div>
  );
}
