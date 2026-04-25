import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useScheduler } from './hooks/useScheduler';
import { useKeyboard } from './hooks/useKeyboard';
import TitleBar from './components/TitleBar';
import Home from './components/Home';
import Settings from './components/Settings';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';

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

  useScheduler({ tasks, activeBackups, settings, onDue: (task) => startBackup(task) });

  useKeyboard([
    { key: ',', ctrl: true, handler: () => setView('settings') },
    { key: '1', ctrl: true, handler: () => setView('home') },
    { key: '2', ctrl: true, handler: () => setView('settings') },
  ]);

  if (!loaded) return <div className="app-loading" role="status">Loading…</div>;

  return (
    <div className="app">
      <TitleBar view={view} setView={setView} />
      <main className="content">
        {view === 'home' ? <Home /> : <Settings />}
      </main>
      <ConfirmDialog state={confirmState} onResolve={handleConfirm} />
      <Toast toast={toast} />
    </div>
  );
}
