import React from 'react';
import { useApp } from '../context/AppContext';
import CandleChart from './charts/CandleChart';
import TaskList from './charts/TaskList';
import GroupedBarChart from './charts/GroupedBarChart';

export default function Statistics() {
  const { tasks, history } = useApp();

  return (
    <>
      <div className="stat-block" style={{ '--stat-delay': '0ms' }}>
        <div className="stat-block__head">Backed Up</div>
        <CandleChart entries={history} />
      </div>

      <div className="stat-block" style={{ '--stat-delay': '90ms' }}>
        <div className="stat-block__head">Tasks</div>
        <TaskList tasks={tasks} />
      </div>

      <div className="stat-block" style={{ '--stat-delay': '180ms' }}>
        <div className="stat-block__head">Successful Runs</div>
        <GroupedBarChart tasks={tasks} history={history} />
      </div>
    </>
  );
}
