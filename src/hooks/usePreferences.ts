import { useState, useEffect, useCallback } from 'react'
import { savePreferences, getPreferences, UserPreferences } from '../lib/db'

const DEFAULT_PREFERENCES: UserPreferences = {
  id: 'user',
  targetLanguage: 'en',
  selectedCountries: ['US', 'GB', 'DE'],
  theme: 'system',
  autoTranslate: true,
  showBiasIndicators: true,
  // Cost control settings - all disabled by default
  autoAnalyzeBias: false,
  autoAssessTrust: false,
  autoDetectFakeNews: false,
  autoAnalyzeImages: false,
  autoTranslateOnFetch: false,
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPreferences = async () => {
      const stored = await getPreferences()
      if (stored) {
        setPreferences(stored)
      }
      setIsLoading(false)
    }
    loadPreferences()
  }, [])

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...preferences, ...updates }
    setPreferences(newPrefs)
    await savePreferences(newPrefs)
  }, [preferences])

  const toggleCountry = useCallback(async (countryCode: string) => {
    const selected = preferences.selectedCountries.includes(countryCode)
      ? preferences.selectedCountries.filter(c => c !== countryCode)
      : [...preferences.selectedCountries, countryCode]
    await updatePreferences({ selectedCountries: selected })
  }, [preferences.selectedCountries, updatePreferences])

  return { preferences, isLoading, updatePreferences, toggleCountry }
}
