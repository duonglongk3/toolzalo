import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface LicenseInfo {
  key: string
  product: string
  productSlug: string
  type: string
  status: string
  expiryDate: string
  daysRemaining: number
  isLifetime: boolean
  maxDevices: number
  activeDevices: number
}

export interface LicenseCheckResult {
  success: boolean
  valid: boolean
  code: string
  error?: string
  license?: LicenseInfo
  expiredAt?: string
  timestamp?: string
}

interface LicenseContextType {
  isLicenseValid: boolean
  isLoading: boolean
  licenseInfo: LicenseInfo | null
  error: string | null
  checkLicense: (key: string, forceCheck?: boolean) => Promise<LicenseCheckResult>
  clearLicense: () => void
  hwid: string
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined)

export const useLicense = () => {
  const context = useContext(LicenseContext)
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider')
  }
  return context
}

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLicenseValid, setIsLicenseValid] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hwid, setHwid] = useState('')

  // Get HWID on mount
  useEffect(() => {
    window.electronAPI.license.getHWID().then(setHwid)
  }, [])

  // Check stored license on mount
  useEffect(() => {
    const checkStoredLicense = async () => {
      try {
        const stored = await window.electronAPI.license.getStored()
        console.log('🔍 Stored license:', stored)
        
        if (stored?.key && stored?.lastResult?.valid) {
          console.log('🔑 Re-verifying license with server (forceCheck=true)...')
          // Re-verify the stored license - always force check with server
          const result = await window.electronAPI.license.check(stored.key, true)
          console.log('🔑 Verify result:', result)
          
          if (result.valid && result.license) {
            setIsLicenseValid(true)
            setLicenseInfo(result.license)
            setError(null)
          } else {
            setIsLicenseValid(false)
            setLicenseInfo(null)
            setError(result.error || 'License không hợp lệ')
          }
        } else {
          setIsLicenseValid(false)
        }
      } catch (err: any) {
        console.error('Error checking stored license:', err)
        setError(err?.message || 'Lỗi kiểm tra license')
      } finally {
        setIsLoading(false)
      }
    }

    checkStoredLicense()
  }, [])

  const checkLicense = useCallback(async (key: string, forceCheck = true): Promise<LicenseCheckResult> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.license.check(key, forceCheck)

      if (result.valid && result.license) {
        setIsLicenseValid(true)
        setLicenseInfo(result.license)
        setError(null)
      } else {
        setIsLicenseValid(false)
        setLicenseInfo(null)
        setError(result.error || 'License không hợp lệ')
      }

      return result
    } catch (err: any) {
      const errorResult: LicenseCheckResult = {
        success: false,
        valid: false,
        code: 'ERROR',
        error: err?.message || 'Lỗi kiểm tra license'
      }
      setError(errorResult.error!)
      return errorResult
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearLicense = useCallback(() => {
    window.electronAPI.license.clear()
    setIsLicenseValid(false)
    setLicenseInfo(null)
    setError(null)
  }, [])

  return (
    <LicenseContext.Provider
      value={{
        isLicenseValid,
        isLoading,
        licenseInfo,
        error,
        checkLicense,
        clearLicense,
        hwid
      }}
    >
      {children}
    </LicenseContext.Provider>
  )
}
