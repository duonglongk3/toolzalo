import React, { createContext, useContext, useCallback } from 'react'
import { translations, Language } from './translations'
import { useAppStore } from '@/store'

type TranslationsType = typeof translations.vi

interface I18nContextType {
  t: (key: string, params?: Record<string, string | number>) => string
  language: Language
  setLanguage: (lang: Language) => void
}

const I18nContext = createContext<I18nContextType | null>(null)

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config, updateConfig } = useAppStore()
  const language = config.language || 'vi'

  const setLanguage = useCallback((lang: Language) => {
    updateConfig({ language: lang })
  }, [updateConfig])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: any = translations[language]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Fallback to Vietnamese if key not found
        value = translations.vi
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey]
          } else {
            return key // Return key if not found
          }
        }
        break
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // Replace params like {name} with actual values
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey]?.toString() || `{${paramKey}}`
      })
    }

    return value
  }, [language])

  return React.createElement(I18nContext.Provider, { value: { t, language, setLanguage } }, children)
}

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

export { translations, type Language }
