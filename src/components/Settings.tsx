import { UserPreferences } from '../lib/db'
import { languageNames } from '../lib/countries'

interface SettingsProps {
  preferences: UserPreferences
  onUpdate: (updates: Partial<UserPreferences>) => void
  onLogout: () => void
}

export function Settings({ preferences, onUpdate, onLogout }: SettingsProps) {
  return (
    <div className="settings">
      <h3>Settings</h3>

      <div className="setting-group">
        <label htmlFor="targetLanguage">Translation Language</label>
        <select
          id="targetLanguage"
          value={preferences.targetLanguage}
          onChange={e => onUpdate({ targetLanguage: e.target.value })}
        >
          {Object.entries(languageNames).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label htmlFor="theme">Theme</label>
        <select
          id="theme"
          value={preferences.theme}
          onChange={e => onUpdate({ theme: e.target.value as 'light' | 'dark' | 'system' })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={preferences.autoTranslate}
            onChange={e => onUpdate({ autoTranslate: e.target.checked })}
          />
          Auto-translate articles
        </label>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={preferences.showBiasIndicators}
            onChange={e => onUpdate({ showBiasIndicators: e.target.checked })}
          />
          Show bias indicators
        </label>
      </div>

      <div className="danger-zone">
        <h4>Danger Zone</h4>
        <button className="danger" onClick={onLogout}>
          Logout & Clear Credentials
        </button>
      </div>
    </div>
  )
}
