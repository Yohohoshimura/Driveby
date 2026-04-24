import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useScheduler } from './hooks/useScheduler';
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
  const { loaded, toast, confirmState, handleConfirm, tasks, activeBackups, settings, startBackup } = useApp();
  const [view, setView] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useScheduler({ tasks, activeBackups, settings, onDue: (task) => startBackup(task) });

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
