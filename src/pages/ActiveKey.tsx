import React, { useState } from 'react'
import { Key, CheckCircle, XCircle, Loader2, Copy, AlertTriangle, Calendar, Monitor, Package } from 'lucide-react'
import { Button, Card, CardContent, Input, Badge } from '@/components/ui'
import { useLicense } from '@/contexts/LicenseContext'
import toast from 'react-hot-toast'

const ActiveKey: React.FC = () => {
  const { isLicenseValid, isLoading, licenseInfo, error, checkLicense, clearLicense, hwid } = useLicense()
  const [inputKey, setInputKey] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  const handleActivate = async () => {
    const key = inputKey.trim()
    if (!key) {
      toast.error('Vui lòng nhập license key')
      return
    }

    setIsChecking(true)
    try {
      const result = await checkLicense(key, true)
      
      if (result.valid && result.license) {
        setInputKey('')
        // Hiển thị thông tin license ngay sau khi kích hoạt
        const expiryText = result.license.isLifetime 
          ? 'Vĩnh viễn' 
          : `đến ${new Date(result.license.expiryDate).toLocaleDateString('vi-VN')}`
        toast.success(`Kích hoạt thành công!\nHạn sử dụng: ${expiryText}\nMã máy: ${hwid}`, {
          duration: 5000
        })
      } else {
        const errorMessages: Record<string, string> = {
          'INVALID_KEY': 'License key không tồn tại trong hệ thống',
          'LICENSE_EXPIRED': 'License đã hết hạn',
          'LICENSE_SUSPENDED': 'License bị tạm khóa',
          'LICENSE_REVOKED': 'License bị thu hồi',
          'DEVICE_LIMIT': 'Đã đạt giới hạn số thiết bị được phép',
          'NETWORK_ERROR': 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.',
        }
        toast.error(errorMessages[result.code] || result.error || 'Kích hoạt thất bại')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Có lỗi xảy ra')
    } finally {
      setIsChecking(false)
    }
  }

  const handleCopyHWID = () => {
    navigator.clipboard.writeText(hwid)
    toast.success('Đã copy HWID')
  }

  const handleDeactivate = () => {
    if (window.confirm('Bạn có chắc muốn hủy kích hoạt license này?')) {
      clearLicense()
      toast.success('Đã hủy kích hoạt license')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getLicenseTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'default' }> = {
      'lifetime': { label: 'Vĩnh viễn', variant: 'success' },
      'yearly': { label: 'Năm', variant: 'info' },
      'monthly': { label: 'Tháng', variant: 'default' },
      'trial': { label: 'Dùng thử', variant: 'warning' },
    }
    const config = types[type] || { label: type, variant: 'default' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
          <p className="mt-4 text-secondary-600">Đang kiểm tra license...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Key className="w-8 h-8 sm:w-10 sm:h-10 text-primary-600" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary-900">Kích hoạt License</h1>
          <p className="text-sm sm:text-base text-secondary-600 mt-2">
            Nhập license key để sử dụng đầy đủ tính năng của ứng dụng
          </p>
        </div>

        {/* HWID Display */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-secondary-500">Hardware ID (HWID)</p>
                <p className="font-mono text-xs sm:text-sm text-secondary-900 mt-1 truncate">{hwid || '...'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopyHWID} title="Copy HWID" className="flex-shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLicenseValid && licenseInfo ? (
          /* Licensed State */
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-green-700 truncate">License đã kích hoạt</h2>
                  <p className="text-xs sm:text-sm text-green-600 truncate">{licenseInfo.product}</p>
                </div>
              </div>

              {/* Thông tin quan trọng - Hạn sử dụng & Mã máy */}
              <div className="bg-white rounded-lg p-3 sm:p-4 mb-4 border border-green-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 pb-3 border-b border-green-100 gap-1 sm:gap-0">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-secondary-600">Hạn sử dụng:</span>
                  </div>
                  <span className="font-semibold text-green-700 text-sm sm:text-base ml-6 sm:ml-0">
                    {licenseInfo.isLifetime ? 'Vĩnh viễn' : formatDate(licenseInfo.expiryDate)}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                  <div className="flex items-center">
                    <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-secondary-600">Mã máy (HWID):</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6 sm:ml-0">
                    <span className="font-mono text-xs sm:text-sm text-secondary-900 truncate max-w-[180px] sm:max-w-none">{hwid}</span>
                    <Button variant="ghost" size="sm" onClick={handleCopyHWID} className="p-1 h-auto flex-shrink-0">
                      <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-400 mr-2 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-secondary-500">Loại license</p>
                    {getLicenseTypeBadge(licenseInfo.type)}
                  </div>
                </div>

                <div className="flex items-center">
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-400 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] sm:text-xs text-secondary-500">Thiết bị</p>
                    <p className="font-medium text-sm">{licenseInfo.activeDevices}/{licenseInfo.maxDevices}</p>
                  </div>
                </div>

                <div className="flex items-center col-span-2">
                  <Key className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-400 mr-2 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-secondary-500">License Key</p>
                    <p className="font-mono text-xs sm:text-sm truncate">{licenseInfo.key.substring(0, 15)}...</p>
                  </div>
                </div>
              </div>

              {/* Warning for expiring soon */}
              {!licenseInfo.isLifetime && licenseInfo.daysRemaining <= 7 && licenseInfo.daysRemaining > 0 && (
                <div className="mt-4 p-2 sm:p-3 bg-yellow-100 rounded-lg flex items-start sm:items-center">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span className="text-xs sm:text-sm text-yellow-700">
                    License sẽ hết hạn trong {licenseInfo.daysRemaining} ngày. Hãy gia hạn để tiếp tục sử dụng.
                  </span>
                </div>
              )}

              <div className="mt-4 sm:mt-6 pt-4 border-t border-green-200">
                <Button variant="outline" onClick={handleDeactivate} className="text-red-600 hover:bg-red-50 text-sm">
                  Hủy kích hoạt
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Not Licensed State */
          <Card>
            <CardContent className="p-4 sm:p-6">
              {error && (
                <div className="mb-4 p-2 sm:p-3 bg-red-50 rounded-lg flex items-start">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-red-700">Lỗi kích hoạt</p>
                    <p className="text-xs sm:text-sm text-red-600 break-words">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 sm:space-y-4">
                <Input
                  label="License Key"
                  placeholder="VD: SAP-XXXX-XXXX-XXXX-XXXX"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                  className="text-sm"
                />

                <Button
                  onClick={handleActivate}
                  loading={isChecking}
                  className="w-full"
                  icon={<Key className="w-4 h-4" />}
                >
                  Kích hoạt License
                </Button>
              </div>

              <div className="mt-4 sm:mt-6 pt-4 border-t border-secondary-200 text-center">
                <p className="text-xs sm:text-sm text-secondary-500">
                  Chưa có license key?{' '}
                  <a
                    href="https://tool.socialautopro.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Mua ngay
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default ActiveKey
