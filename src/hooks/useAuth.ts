import { useState, useEffect, useCallback } from 'react'
import { storeEncryptedApiKey, retrieveApiKey, hasStoredApiKey, clearStoredApiKey } from '../lib/crypto'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  hasStoredKey: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    hasStoredKey: false,
    error: null,
  })

  useEffect(() => {
    const checkAuth = async () => {
      const hasKey = hasStoredApiKey()
      const isInitialized = await window.electronAPI.anthropic.isInitialized()
      setState({
        isAuthenticated: isInitialized,
        isLoading: false,
        hasStoredKey: hasKey,
        error: null,
      })
    }
    checkAuth()
  }, [])

  const login = useCallback(async (apiKey: string, passphrase: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const testResult = await window.electronAPI.anthropic.testKey(apiKey)
      if (!testResult.valid) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: testResult.error || 'Invalid API key',
        }))
        return false
      }

      const initResult = await window.electronAPI.anthropic.initialize(apiKey)
      if (!initResult.success) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: initResult.error || 'Failed to initialize',
        }))
        return false
      }

      await storeEncryptedApiKey(apiKey, passphrase)

      setState({
        isAuthenticated: true,
        isLoading: false,
        hasStoredKey: true,
        error: null,
      })
      return true
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: String(err),
      }))
      return false
    }
  }, [])

  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const apiKey = await retrieveApiKey(passphrase)
      const initResult = await window.electronAPI.anthropic.initialize(apiKey)
      if (!initResult.success) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to initialize',
        }))
        return false
      }

      setState({
        isAuthenticated: true,
        isLoading: false,
        hasStoredKey: true,
        error: null,
      })
      return true
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Invalid passphrase or corrupted data',
      }))
      return false
    }
  }, [])

  const logout = useCallback(() => {
    clearStoredApiKey()
    setState({
      isAuthenticated: false,
      isLoading: false,
      hasStoredKey: false,
      error: null,
    })
  }, [])

  const verifyPassphrase = useCallback(async (passphrase: string): Promise<boolean> => {
    try {
      // Try to retrieve the API key with the passphrase
      // If it works, the passphrase is correct
      await retrieveApiKey(passphrase)
      return true
    } catch {
      return false
    }
  }, [])

  const updateApiKey = useCallback(async (newApiKey: string, passphrase: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Test the new API key
      const testResult = await window.electronAPI.anthropic.testKey(newApiKey)
      if (!testResult.valid) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: testResult.error || 'Invalid API key',
        }))
        return false
      }

      // Initialize with new key
      const initResult = await window.electronAPI.anthropic.initialize(newApiKey)
      if (!initResult.success) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: initResult.error || 'Failed to initialize',
        }))
        return false
      }

      // Store the new encrypted key
      await storeEncryptedApiKey(newApiKey, passphrase)

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
      }))
      return true
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: String(err),
      }))
      return false
    }
  }, [])

  return { ...state, login, unlock, logout, verifyPassphrase, updateApiKey }
}
