import React from 'react';
import { useApp } from '../context/AppContext';
import Button from './common/Button';
import Toggle from './common/Toggle';
import InfoTip from './common/InfoTip';
import { bridge } from '../lib/tauri';
import { ACCENTS } from '../lib/accent';

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
            <div className="field-row" style={{ maxWidth: 360 }}>
              <input
                type="text"
                value={settings.defaultDestination}
                readOnly
                placeholder="Not set"
                className="field field--readonly"
                style={{ minWidth: 180 }}
                aria-label="Default destination"
                autoComplete="off"
                name="driveby-default-destination"
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
            <Toggle value={settings.confirmBeforeBackup} onChange={(v) => updateSetting('confirmBeforeBackup', v)} label="Confirm before backup" />
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-row__label">System notifications</div>
          </div>
          <div className="setting-row__control">
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
            <InfoTip text="After copying, Driveby reads each file back and compares it against the original to make sure nothing got corrupted on the way. A bit slower, but recommended for important data." />
            <Toggle value={!!settings.verify} onChange={(v) => updateSetting('verify', v)} label="Verify after copy" />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Continue on error</div>
          </div>
          <div className="setting-row__control">
            <InfoTip text="If a single file can't be copied — for example because it's locked by another app or you don't have permission — Driveby will skip it and keep backing up everything else instead of stopping the whole job." />
            <Toggle value={settings.continueOnError !== false} onChange={(v) => updateSetting('continueOnError', v)} label="Continue on error" />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-row__label">Preserve file modification time</div>
          </div>
          <div className="setting-row__control">
            <InfoTip text="Keeps each file's original 'last modified' date when it's copied to the destination. This lets later backups instantly skip files that haven't changed, making repeat runs much faster." />
            <Toggle value={settings.preserveMtime !== false} onChange={(v) => updateSetting('preserveMtime', v)} label="Preserve mtime" />
          </div>
        </div>
      </div>

      <div className="group-title">Filtering</div>
      <div className="group">
        <div className="setting-row setting-row--stacked">
          <div className="setting-row__control" style={{ justifyContent: 'flex-start', justifySelf: 'start' }}>
            <div className="setting-row__label">Exclude patterns</div>
            <InfoTip placement="right" text="List the files or folders you don't want backed up — one per line, or separated by commas. Use * to match any characters in a name, ** to match across folders, and ? for a single character. Start a line with ! to bring something back in (for example, !important.tmp keeps that file even if *.tmp is excluded)." />
          </div>
          <textarea
            value={settings.excludePatterns}
            onChange={(e) => updateSetting('excludePatterns', e.target.value)}
            placeholder={'*.tmp\nnode_modules\n.DS_Store\n!important.tmp'}
            className="field field--textarea"
            rows={5}
            aria-label="Exclude patterns"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="driveby-exclude-patterns"
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

        <div className="setting-row">
          <div>
            <div className="setting-row__label">Accent color</div>
          </div>
          <div className="setting-row__control" role="radiogroup" aria-label="Accent color" style={{ gap: 8, flexWrap: 'wrap' }}>
            {ACCENTS.map((a) => {
              const selected = settings.accentColor === a.key;
              return (
                <button
                  key={a.key}
                  role="radio"
                  aria-checked={selected}
                  aria-label={a.label}
                  title={a.label}
                  onClick={() => updateSetting('accentColor', a.key)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: a.color,
                    border: selected ? '2px solid var(--label-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              );
            })}
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
