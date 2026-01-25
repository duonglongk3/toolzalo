import React from 'react'
import { Loader2 } from 'lucide-react'
import { useLicense } from '@/contexts/LicenseContext'
import ActiveKey from '@/pages/ActiveKey'

interface LicenseGuardProps {
  children: React.ReactNode
}

const LicenseGuard: React.FC<LicenseGuardProps> = ({ children }) => {
  const { isLicenseValid, isLoading } = useLicense()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-secondary-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
          <p className="mt-4 text-secondary-600">Đang kiểm tra license...</p>
        </div>
      </div>
    )
  }

  if (!isLicenseValid) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <ActiveKey />
      </div>
    )
  }

  return <>{children}</>
}

export default LicenseGuard
