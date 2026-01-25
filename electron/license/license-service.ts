import { createHash } from 'crypto'
import os from 'os'
import Store from 'electron-store'

const LICENSE_API_URL = 'https://tool.socialautopro.com/api/check-key'
const APP_VERSION = '1.0.0'
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

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

export interface StoredLicense {
  key: string
  lastCheck: number
  lastResult: LicenseCheckResult | null
}

const licenseStore = new Store<{ license: StoredLicense | null }>({
  name: 'license',
  defaults: {
    license: null
  }
})

export function generateHWID(): string {
  const cpus = os.cpus()
  const networkInterfaces = os.networkInterfaces()
  
  // Get first non-internal MAC address
  let mac = ''
  for (const name in networkInterfaces) {
    const interfaces = networkInterfaces[name]
    if (interfaces) {
      for (const iface of interfaces) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          mac = iface.mac
          break
        }
      }
    }
    if (mac) break
  }

  const data = [
    os.hostname(),
    os.platform(),
    os.arch(),
    cpus[0]?.model || '',
    cpus.length.toString(),
    os.totalmem().toString(),
    mac
  ].join('|')

  return createHash('sha256').update(data).digest('hex').substring(0, 32).toUpperCase()
}

export async function checkLicense(key: string, forceCheck = false): Promise<LicenseCheckResult> {
  const hwid = generateHWID()
  
  // Check cache first (unless force check)
  if (!forceCheck) {
    const stored = licenseStore.get('license')
    if (stored && stored.key === key && stored.lastResult) {
      const elapsed = Date.now() - stored.lastCheck
      if (elapsed < CACHE_DURATION_MS && stored.lastResult.valid) {
        console.log('📋 Using cached license result')
        return stored.lastResult
      }
    }
  }

  console.log('🔑 Checking license with API...')
  console.log('   Key:', key.substring(0, 10) + '...')
  console.log('   HWID:', hwid)
  console.log('   ForceCheck:', forceCheck)

  const requestBody = {
    key,
    hwid,
    appVersion: APP_VERSION
  }
  console.log('   Request body:', JSON.stringify(requestBody))

  try {
    const response = await fetch(LICENSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HWID': hwid,
        'X-App-Version': APP_VERSION
      },
      body: JSON.stringify(requestBody)
    })

    const result: LicenseCheckResult = await response.json()
    
    // Store result
    licenseStore.set('license', {
      key,
      lastCheck: Date.now(),
      lastResult: result
    })

    if (result.valid) {
      console.log('✅ License valid!')
      console.log('   Product:', result.license?.product)
      console.log('   Days remaining:', result.license?.daysRemaining)
    } else {
      console.log('❌ License invalid:', result.code, result.error)
    }

    return result
  } catch (error: any) {
    console.error('❌ License check failed:', error.message)
    
    // If network error, check if we have a cached valid result
    const stored = licenseStore.get('license')
    if (stored && stored.key === key && stored.lastResult?.valid) {
      console.log('⚠️ Using cached result due to network error')
      return stored.lastResult
    }

    return {
      success: false,
      valid: false,
      code: 'NETWORK_ERROR',
      error: 'Không thể kết nối đến server kiểm tra license. Vui lòng kiểm tra kết nối mạng.'
    }
  }
}

export function getStoredLicense(): StoredLicense | null {
  return licenseStore.get('license')
}

export function clearStoredLicense(): void {
  licenseStore.delete('license')
}

export function isLicenseExpiringSoon(daysRemaining: number): boolean {
  return daysRemaining <= 7 && daysRemaining > 0
}

export function formatExpiryDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
