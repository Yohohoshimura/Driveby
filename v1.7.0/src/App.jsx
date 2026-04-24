import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useKeyboard } from './hooks/useKeyboard';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import Home from './components/Home';
import History from './components/History';
import Settings from './components/Settings';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';

const TITLES = {
  home: 'Tasks',
  history: 'History',
  settings: 'Settings',
};

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { loaded, toast, confirmState, handleConfirm, settings, updateSetting } = useApp();
  const [view, setView] = useState(() => settings.lastView || 'home');
  const [sidebarOpen, setSidebarOpen] = useState(() => settings.sidebarOpen !== false);

  // Sync initial values once settings load
  useEffect(() => {
    if (settings.lastView && settings.lastView !== view) setView(settings.lastView);
    if (typeof settings.sidebarOpen === 'boolean') setSidebarOpen(settings.sidebarOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Persist view + sidebar state on change
  useEffect(() => {
    if (!loaded) return;
    if (settings.lastView !== view) updateSetting('lastView', view);
  }, [view, loaded]);
  useEffect(() => {
    if (!loaded) return;
    if (settings.sidebarOpen !== sidebarOpen) updateSetting('sidebarOpen', sidebarOpen);
  }, [sidebarOpen, loaded]);

  useKeyboard([
    { key: ',', ctrl: true, handler: () => setView('settings') },
    { key: '1', ctrl: true, handler: () => setView('home') },
    { key: '2', ctrl: true, handler: () => setView('history') },
    { key: '3', ctrl: true, handler: () => setView('settings') },
    { key: 's', ctrl: true, handler: () => setSidebarOpen((v) => !v) },
  ]);

  if (!loaded) return <div className="app-loading" role="status">Loading…</div>;

  return (
    <div className={`app ${sidebarOpen ? 'app--sidebar-open' : 'app--sidebar-closed'}`}>
      {sidebarOpen && <Sidebar view={view} setView={setView} />}
      <div className="main">
        <Toolbar
          title={TITLES[view]}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main className="content">
          <div className="content__inner">
            {view === 'home' && <Home />}
            {view === 'history' && <History />}
            {view === 'settings' && <Settings />}
          </div>
        </main>
      </div>
      <ConfirmDialog state={confirmState} onResolve={handleConfirm} />
      <Toast toast={toast} />
    </div>
  );
}
