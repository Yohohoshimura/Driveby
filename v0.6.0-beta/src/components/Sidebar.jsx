import React, { useState, useMemo } from 'react';
import { Search, FolderSync, Clock, Settings as Cog, HardDrive } from 'lucide-react';

const NAV = [
  {
    section: 'Library',
    items: [
      { id: 'home', label: 'Tasks', icon: FolderSync },
      { id: 'history', label: 'History', icon: Clock },
    ],
  },
  {
    section: 'App',
    items: [
      { id: 'settings', label: 'Settings', icon: Cog },
    ],
  },
];

export default function Sidebar({ view, setView }) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    if (!query.trim()) return NAV;
    const q = query.toLowerCase();
    return NAV
      .map((sec) => ({ ...sec, items: sec.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((sec) => sec.items.length > 0);
  }, [query]);

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar__drag" />

      <div className="sidebar__search">
        <Search size={12} className="sidebar__search-icon" />
        <input
          type="search"
          className="sidebar__search-input"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search navigation"
        />
      </div>

      <nav className="sidebar__nav">
        {sections.map((sec) => (
          <div key={sec.section} className="sidebar__group">
            <div className="sidebar__group-title">{sec.section}</div>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar__item ${active ? 'sidebar__item--active' : ''}`}
                  onClick={() => setView(item.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={14} className="sidebar__item-icon" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__brand">
          <HardDrive size={16} />
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-name">BackupDrive</div>
            <div className="sidebar__brand-version">Version 0.6</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
