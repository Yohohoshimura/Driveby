import React from 'react';
import { PanelLeft } from 'lucide-react';

export default function Toolbar({ title, sidebarOpen, onToggleSidebar, rightSlot }) {
  return (
    <header className="toolbar">
      <button
        type="button"
        className="toolbar__toggle"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        aria-pressed={sidebarOpen}
      >
        <PanelLeft size={15} />
      </button>
      <div className="toolbar__title">{title}</div>
      <div className="toolbar__right">{rightSlot}</div>
    </header>
  );
}
