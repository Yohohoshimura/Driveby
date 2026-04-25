import React from 'react';
import { useApp } from '../context/AppContext';
import Button from './common/Button';
import Toggle from './common/Toggle';
import InfoTip from './common/InfoTip';
import { bridge } from '../lib/tauri';

export default function Settings() {
  const { settings, updateSetting, showToast } = useApp();

  const pickDefaultDestination = async () => {
    const p = await bridge.selectDirectory('Select default destination');
    if (p) updateSetting('defaultDestination', p);
  };

  const revealLogs = async () => {
    try {
      const dir = await bridge.revealLogsFolder();
      await bridge.revealFolder(dir);
    } catch (e) {
      showToast(`Cannot open logs: ${e}`, 'error');
    }
  };

  return (
    <>
      <div className="group-title">General</div>
      <div className="group">
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Default destination</div>
          </div>
          <div className="setting-row__control" style={{ maxWidth: 380 }}>
            <InfoTip text="Pre-fills the destination for new tasks." />
            <div className="field-row" style={{ maxWidth: 360 }}>
              <input
                type="text"
                value={settings.defaultDestination}
                readOnly
                placeholder="Not set"
                className="field field--readonly"
                style={{ minWidth: 180 }}
                aria-label="Default destination"
              />
              <Button size="small" onClick={pickDefaultDestination}>Choose…</Button>
              {settings.defaultDestination && (
                <Button size="small" variant="borderless" destructive onClick={() => updateSetting('defaultDestination', '')}>Clear</Button>
              )}
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-row__label">Confirm before each backup</div>
          </div>
          <div className="setting-row__control">
            <InfoTip text="Show a dialog before starting any backup." />
            <Toggle value={settings.confirmBeforeBackup} onChange={(v) => updateSetting('confirmBeforeBackup', v)} label="Confirm before backup" />
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-row__label">System notifications</div>
          </div>
          <div className="setting-row__control">
            <InfoTip text="Notify when a backup completes." />
            <Toggle value={settings.showNotifications} onChange={(v) => updateSetting('showNotifications', v)} label="System notifications" />
          </div>
        </div>
      </div>

      <div className="group-title">Backup Options</div>
      <div className="group">
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Verify after copy</div>
          </div>
          <div className="setting-row__control">
            <InfoTip text="Hash (xxHash3) every copied file after writing. Slower but safer." />
            <Toggle value={!!settings.verify} onChange={(v) => updateSetting('verify', v)} label="Verify after copy" />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Continue on error</div>
          </div>
          <div className="setting-row__control">
            <InfoTip text="If a file fails to copy, keep going instead of aborting." />
            <Toggle value={settings.continueOnError !== false} onChange={(v) => updateSetting('continueOnError', v)} label="Continue on error" />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Preserve file modification time</div>
          </div>
          <div className="setting-row__control">
            <InfoTip text="Copy each file's mtime so re-runs can skip unchanged files." />
            <Toggle value={settings.preserveMtime !== false} onChange={(v) => updateSetting('preserveMtime', v)} label="Preserve mtime" />
          </div>
        </div>
      </div>

      <div className="group-title">Filtering</div>
      <div className="group">
        <div className="setting-row setting-row--stacked">
          <div className="setting-row__control" style={{ justifyContent: 'flex-start', justifySelf: 'start' }}>
            <div className="setting-row__label">Exclude patterns</div>
            <InfoTip placement="right" text="Comma- or newline-separated. Globs: *, **, ?. Prefix with ! to re-include." />
          </div>
          <textarea
            value={settings.excludePatterns}
            onChange={(e) => updateSetting('excludePatterns', e.target.value)}
            placeholder={'*.tmp\nnode_modules\n.DS_Store\n!important.tmp'}
            className="field field--textarea"
            rows={5}
            aria-label="Exclude patterns"
          />
        </div>
      </div>

      <div className="group-title">Appearance</div>
      <div className="group">
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Appearance</div>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {['light', 'dark', 'system'].map((opt) => (
              <button
                key={opt}
                role="radio"
                aria-checked={settings.theme === opt}
                className={`segmented__btn ${settings.theme === opt ? 'segmented__btn--active' : ''}`}
                onClick={() => updateSetting('theme', opt)}
                style={{ textTransform: 'capitalize' }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className="group-title">Diagnostics</div>
      <div className="group">
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Application logs</div>
          </div>
          <Button size="small" onClick={revealLogs}>Open</Button>
        </div>
      </div>
    </>
  );
}
