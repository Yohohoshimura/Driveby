import React from 'react';
import { useApp } from '../context/AppContext';
import Button from './common/Button';
import Toggle from './common/Toggle';
import { ACCENTS } from '../lib/accent';
import { bridge } from '../lib/tauri';

export default function Settings() {
  const { settings, updateSetting } = useApp();

  const pickDefaultDestination = async () => {
    const p = await bridge.selectDirectory('Select default destination');
    if (p) updateSetting('defaultDestination', p);
  };

  return (
    <>
      <div className="group-title">General</div>
      <div className="group">
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Default destination</div>
            <div className="setting-row__hint">Pre-fills the destination for new tasks.</div>
          </div>
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

        <div className="setting-row">
          <div>
            <div className="setting-row__label">Confirm before each backup</div>
            <div className="setting-row__hint">Show a dialog before starting any backup.</div>
          </div>
          <Toggle value={settings.confirmBeforeBackup} onChange={(v) => updateSetting('confirmBeforeBackup', v)} label="Confirm before backup" />
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-row__label">System notifications</div>
            <div className="setting-row__hint">Notify when a backup completes.</div>
          </div>
          <Toggle value={settings.showNotifications} onChange={(v) => updateSetting('showNotifications', v)} label="System notifications" />
        </div>
      </div>

      <div className="group-title">Filtering</div>
      <div className="group">
        <div className="setting-row setting-row--stacked">
          <div>
            <div className="setting-row__label">Exclude patterns</div>
            <div className="setting-row__hint">
              Comma- or newline-separated. Globs: <code>*</code>, <code>**</code>, <code>?</code>. Prefix with <code>!</code> to re-include.
            </div>
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

      <div className="group-title">Maintenance</div>
      <div className="group">
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Auto-cleanup old backups</div>
            <div className="setting-row__hint">Delete BackupDrive folders older than N days after each run. 0 = off.</div>
          </div>
          <div className="field-row">
            <input
              type="number"
              min="0"
              max="365"
              value={settings.autoCleanupDays}
              onChange={(e) => updateSetting('autoCleanupDays', parseInt(e.target.value, 10) || 0)}
              className="field field--narrow"
              aria-label="Cleanup days"
            />
            <span className="subhead">days</span>
          </div>
        </div>
      </div>

      <div className="group-title">Appearance</div>
      <div className="group">
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Appearance</div>
            <div className="setting-row__hint">Match system or pick a mode.</div>
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

        <div className="setting-row">
          <div>
            <div className="setting-row__label">Accent color</div>
            <div className="setting-row__hint">Used for buttons, toggles and progress.</div>
          </div>
          <div className="accent-swatches">
            {ACCENTS.map(({ key, color, label }) => (
              <button
                key={key}
                onClick={() => updateSetting('accentColor', key)}
                className={`swatch ${settings.accentColor === key ? 'swatch--active' : ''}`}
                style={{ background: color, color: color }}
                aria-label={label}
                aria-pressed={settings.accentColor === key}
                title={label}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
