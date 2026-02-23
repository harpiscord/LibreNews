import { useState } from 'react'

interface LoginScreenProps {
  hasStoredKey: boolean
  onLogin: (apiKey: string, passphrase: string) => Promise<boolean>
  onUnlock: (passphrase: string) => Promise<boolean>
  isLoading: boolean
  error: string | null
}

export function LoginScreen({ hasStoredKey, onLogin, onUnlock, isLoading, error }: LoginScreenProps) {
  const [apiKey, setApiKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [isNewUser, setIsNewUser] = useState(!hasStoredKey)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isNewUser) {
      if (passphrase !== confirmPassphrase) {
        alert('Passphrases do not match')
        return
      }
      if (passphrase.length < 8) {
        alert('Passphrase must be at least 8 characters')
        return
      }
      await onLogin(apiKey, passphrase)
    } else {
      await onUnlock(passphrase)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-container">
        <h1>LibreNews</h1>
        <p className="subtitle">AI-Powered News Analysis</p>

        <form onSubmit={handleSubmit}>
          {isNewUser ? (
            <>
              <div className="form-group">
                <label htmlFor="apiKey">Anthropic API Key</label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  required
                />
                <small>Your API key is encrypted locally and never sent to any server except Anthropic.</small>
              </div>

              <div className="form-group">
                <label htmlFor="passphrase">Create Passphrase</label>
                <input
                  type="password"
                  id="passphrase"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassphrase">Confirm Passphrase</label>
                <input
                  type="password"
                  id="confirmPassphrase"
                  value={confirmPassphrase}
                  onChange={e => setConfirmPassphrase(e.target.value)}
                  placeholder="Re-enter passphrase"
                  required
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="passphrase">Enter Passphrase</label>
              <input
                type="password"
                id="passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Your passphrase"
                required
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Please wait...' : isNewUser ? 'Set Up & Login' : 'Unlock'}
          </button>

          {hasStoredKey && (
            <button type="button" className="secondary" onClick={() => setIsNewUser(!isNewUser)}>
              {isNewUser ? 'Use existing credentials' : 'Set up new API key'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
