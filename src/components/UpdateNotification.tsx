import React from 'react'
import { Download, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui'
import toast from 'react-hot-toast'

interface UpdateStatus {
  status: string
  data?: {
    version?: string
    releaseDate?: string
    releaseNotes?: string | { note: string }[]
    percent?: number
    transferred?: number
    total?: number
    bytesPerSecond?: number
    error?: string
  }
}

const UpdateNotification: React.FC = () => {
  const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus | null>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const [currentVersion, setCurrentVersion] = React.useState('')

  React.useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.updater) return

    // Get current version
    api.updater.getVersion().then((version: string) => {
      setCurrentVersion(version)
    })

    // Listen for update status
    const unsubscribe = api.updater.onStatus((data: UpdateStatus) => {
      console.log('🔄 Update status:', data)
      setUpdateStatus(data)

      switch (data.status) {
        case 'update-available':
          setIsVisible(true)
          toast.success(`Có bản cập nhật mới: v${data.data?.version}`, { duration: 5000 })
          break
        case 'update-not-available':
          // Don't show notification for this
          break
        case 'update-error':
          toast.error(`Lỗi cập nhật: ${data.data?.error}`)
          break
        case 'update-downloaded':
          setIsVisible(true)
          toast.success('Đã tải xong bản cập nhật. Sẵn sàng cài đặt!', { duration: 5000 })
          break
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const handleCheckUpdate = async () => {
    const api = (window as any).electronAPI
    if (!api?.updater) return

    toast.loading('Đang kiểm tra cập nhật...', { id: 'check-update' })
    const result = await api.updater.checkForUpdates()
    toast.dismiss('check-update')

    if (!result.success) {
      toast.error(`Lỗi: ${result.error}`)
    } else if (!result.updateInfo?.version || result.updateInfo.version === currentVersion) {
      toast.success('Bạn đang sử dụng phiên bản mới nhất!')
    }
  }

  const handleDownload = async () => {
    const api = (window as any).electronAPI
    if (!api?.updater) return

    toast.loading('Đang tải bản cập nhật...', { id: 'download-update' })
    const result = await api.updater.downloadUpdate()
    toast.dismiss('download-update')

    if (!result.success) {
      toast.error(`Lỗi tải: ${result.error}`)
    }
  }

  const handleInstall = () => {
    const api = (window as any).electronAPI
    if (!api?.updater) return

    // Confirm before install
    if (window.confirm('Ứng dụng sẽ khởi động lại để cài đặt bản cập nhật. Bạn có muốn tiếp tục?')) {
      api.updater.installUpdate()
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getReleaseNotes = (notes: string | { note: string }[] | undefined): string => {
    if (!notes) return ''
    if (typeof notes === 'string') return notes
    if (Array.isArray(notes)) return notes.map(n => n.note).join('\n')
    return ''
  }

  // Don't render if no update available
  if (!isVisible || !updateStatus) return null

  const { status, data } = updateStatus

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-secondary-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary-50 border-b border-primary-100">
          <div className="flex items-center space-x-2">
            {status === 'update-available' && <Download className="w-5 h-5 text-primary-600" />}
            {status === 'download-progress' && <RefreshCw className="w-5 h-5 text-primary-600 animate-spin" />}
            {status === 'update-downloaded' && <CheckCircle className="w-5 h-5 text-success-600" />}
            {status === 'update-error' && <AlertCircle className="w-5 h-5 text-error-600" />}
            <span className="font-medium text-secondary-900">
              {status === 'update-available' && 'Có bản cập nhật mới'}
              {status === 'download-progress' && 'Đang tải cập nhật'}
              {status === 'update-downloaded' && 'Sẵn sàng cài đặt'}
              {status === 'update-error' && 'Lỗi cập nhật'}
            </span>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-secondary-400 hover:text-secondary-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {status === 'update-available' && data?.version && (
            <div className="space-y-3">
              <p className="text-sm text-secondary-600">
                Phiên bản mới: <span className="font-semibold text-primary-600">v{data.version}</span>
              </p>
              {getReleaseNotes(data.releaseNotes) && (
                <div className="text-xs text-secondary-500 bg-secondary-50 p-2 rounded max-h-20 overflow-y-auto">
                  {getReleaseNotes(data.releaseNotes)}
                </div>
              )}
              <Button onClick={handleDownload} size="sm" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Tải xuống
              </Button>
            </div>
          )}

          {status === 'download-progress' && data && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-secondary-600">
                <span>{formatBytes(data.transferred || 0)} / {formatBytes(data.total || 0)}</span>
                <span>{formatBytes(data.bytesPerSecond || 0)}/s</span>
              </div>
              <div className="w-full bg-secondary-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${data.percent || 0}%` }}
                />
              </div>
              <p className="text-xs text-center text-secondary-500">
                {(data.percent || 0).toFixed(1)}% hoàn thành
              </p>
            </div>
          )}

          {status === 'update-downloaded' && (
            <div className="space-y-3">
              <p className="text-sm text-secondary-600">
                Bản cập nhật đã được tải xuống và sẵn sàng cài đặt.
              </p>
              <Button onClick={handleInstall} size="sm" className="w-full" variant="primary">
                <RefreshCw className="w-4 h-4 mr-2" />
                Cài đặt và khởi động lại
              </Button>
            </div>
          )}

          {status === 'update-error' && (
            <div className="space-y-3">
              <p className="text-sm text-error-600">
                {data?.error || 'Đã xảy ra lỗi khi cập nhật'}
              </p>
              <Button onClick={handleCheckUpdate} size="sm" variant="outline" className="w-full">
                Thử lại
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdateNotification
