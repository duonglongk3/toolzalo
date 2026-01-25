import React from 'react'
import { QrCode, Loader2, CheckCircle, XCircle, RefreshCw, Smartphone } from 'lucide-react'
import { Modal, Button } from '@/components/ui'

// QR Event Types from zca-js
enum QREventType {
  QRCodeGenerated = 0,
  QRCodeExpired = 1,
  QRCodeScanned = 2,
  QRCodeDeclined = 3,
  GotLoginInfo = 4,
}

interface LoginQRModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (result: {
    credentials: {
      cookie: string
      imei: string
      userAgent: string
    }
    accountInfo: any
  }) => void
}

type QRStatus = 'idle' | 'loading' | 'generated' | 'scanned' | 'confirming' | 'success' | 'error' | 'expired' | 'declined'

const LoginQRModal: React.FC<LoginQRModalProps> = ({ open, onClose, onSuccess }) => {
  const [status, setStatus] = React.useState<QRStatus>('idle')
  const [qrImage, setQrImage] = React.useState<string | null>(null)
  const [scannedUser, setScannedUser] = React.useState<{ avatar: string; display_name: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const startQRLogin = React.useCallback(async () => {
    setStatus('loading')
    setQrImage(null)
    setScannedUser(null)
    setError(null)

    try {
      const result = await window.electronAPI.zalo.loginQRStart()

      if (result.success) {
        setStatus('success')
        onSuccess({
          credentials: result.credentials,
          accountInfo: result.accountInfo
        })
      } else {
        setStatus('error')
        setError(result.error || 'Đăng nhập thất bại')
      }
    } catch (err: any) {
      setStatus('error')
      setError(err?.message || 'Có lỗi xảy ra')
    }
  }, [onSuccess])

  // Listen for QR events
  React.useEffect(() => {
    if (!open) return

    const unsubscribe = window.electronAPI.zalo.onQREvent((event) => {
      console.log('QR Event received:', event)

      switch (event.type) {
        case QREventType.QRCodeGenerated:
          setStatus('generated')
          if (event.data?.image) {
            // Image is base64 encoded
            setQrImage(`data:image/png;base64,${event.data.image}`)
          }
          break

        case QREventType.QRCodeExpired:
          setStatus('expired')
          break

        case QREventType.QRCodeScanned:
          setStatus('scanned')
          setScannedUser(event.data)
          break

        case QREventType.QRCodeDeclined:
          setStatus('declined')
          break

        case QREventType.GotLoginInfo:
          setStatus('confirming')
          break
      }
    })

    return () => {
      unsubscribe()
    }
  }, [open])

  // Start QR login when modal opens
  React.useEffect(() => {
    if (open && status === 'idle') {
      startQRLogin()
    }
  }, [open, status, startQRLogin])

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setStatus('idle')
      setQrImage(null)
      setScannedUser(null)
      setError(null)
    }
  }, [open])

  const handleCancel = async () => {
    try {
      await window.electronAPI.zalo.loginQRCancel()
    } catch {}
    onClose()
  }

  const handleRetry = () => {
    setStatus('idle')
    startQRLogin()
  }

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            <p className="mt-4 text-secondary-600">Đang tạo mã QR...</p>
          </div>
        )

      case 'generated':
        return (
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl shadow-md">
              {qrImage ? (
                <img src={qrImage} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-secondary-100 rounded">
                  <QrCode className="w-16 h-16 text-secondary-400" />
                </div>
              )}
            </div>
            <div className="mt-6 text-center">
              <p className="text-secondary-900 font-medium">Quét mã QR bằng Zalo</p>
              <p className="text-sm text-secondary-500 mt-1">
                Mở ứng dụng Zalo → Quét QR → Xác nhận đăng nhập
              </p>
            </div>
            <div className="flex items-center mt-4 px-4 py-2 bg-blue-50 rounded-lg">
              <Smartphone className="w-5 h-5 text-blue-500 mr-2" />
              <span className="text-sm text-blue-700">Mã QR có hiệu lực trong 100 giây</span>
            </div>
          </div>
        )

      case 'scanned':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="relative">
              {scannedUser?.avatar ? (
                <img
                  src={scannedUser.avatar}
                  alt={scannedUser.display_name}
                  className="w-20 h-20 rounded-full border-4 border-green-500"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="mt-4 text-lg font-medium text-secondary-900">
              {scannedUser?.display_name || 'Đã quét mã QR'}
            </p>
            <p className="text-secondary-500 mt-1">Vui lòng xác nhận trên điện thoại</p>
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin mt-4" />
          </div>
        )

      case 'confirming':
        return (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            <p className="mt-4 text-secondary-600">Đang xử lý đăng nhập...</p>
          </div>
        )

      case 'success':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <p className="mt-4 text-lg font-medium text-green-600">Đăng nhập thành công!</p>
          </div>
        )

      case 'expired':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-yellow-500" />
            </div>
            <p className="mt-4 text-lg font-medium text-secondary-900">Mã QR đã hết hạn</p>
            <p className="text-secondary-500 mt-1">Đang tạo mã mới...</p>
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin mt-4" />
          </div>
        )

      case 'declined':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <p className="mt-4 text-lg font-medium text-red-600">Đăng nhập bị từ chối</p>
            <p className="text-secondary-500 mt-1">Bạn đã từ chối xác nhận trên điện thoại</p>
            <Button onClick={handleRetry} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Thử lại
            </Button>
          </div>
        )

      case 'error':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <p className="mt-4 text-lg font-medium text-red-600">Có lỗi xảy ra</p>
            <p className="text-secondary-500 mt-1">{error || 'Vui lòng thử lại sau'}</p>
            <Button onClick={handleRetry} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Thử lại
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Đăng nhập bằng mã QR"
      size="md"
    >
      <div className="min-h-[300px] flex flex-col">
        {renderContent()}

        {status !== 'success' && (
          <div className="mt-auto pt-4 border-t border-secondary-200">
            <Button variant="outline" onClick={handleCancel} className="w-full">
              Hủy
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default LoginQRModal
