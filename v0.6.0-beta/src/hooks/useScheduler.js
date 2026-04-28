import { useEffect, useRef } from 'react';

const INTERVALS = {
  daily: 86400000,
  weekly: 604800000,
  monthly: 2592000000,
};

export function useScheduler({ tasks, activeBackups, settings, onDue }) {
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue;

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const task of tasks) {
        const interval = INTERVALS[task.schedule];
        if (!interval) continue;
        if (activeBackups[task.id]) continue;
        const last = task.lastBackup ? new Date(task.lastBackup).getTime() : 0;
        if (now - last >= interval) onDueRef.current(task);
      }
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [tasks, activeBackups, settings]);
}
