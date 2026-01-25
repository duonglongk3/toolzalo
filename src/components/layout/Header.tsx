import React from 'react'
import {
  Menu,
  Bell,
  Search,
  Plus,
  Download,
  Upload,
  Settings,
  RefreshCw,
  ArrowDownCircle,
  CheckCircle
} from 'lucide-react'
import { Button, Input, Badge } from '@/components/ui'
import { useAppStore } from '@/store'
import { cn } from '@/utils'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

interface HeaderProps {
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  onAddAccount?: () => void
}

const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  sidebarCollapsed = false,
  onAddAccount
}) => {
  const { notifications } = useAppStore()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showNotifications, setShowNotifications] = React.useState(false)
  
  // Update states
  const [updateStatus, setUpdateStatus] = React.useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready'>('idle')
  const [updateVersion, setUpdateVersion] = React.useState<string>('')
  const [downloadProgress, setDownloadProgress] = React.useState(0)

  const unreadNotifications = notifications.filter(n => !n.id.includes('read')).length

  // Listen for update events
  React.useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.updater) return

    const unsubscribe = api.updater.onStatus((data: { status: string; data?: any }) => {
      switch (data.status) {
        case 'checking-for-update':
          setUpdateStatus('checking')
          break
        case 'update-available':
          setUpdateStatus('available')
          setUpdateVersion(data.data?.version || '')
          break
        case 'update-not-available':
          setUpdateStatus('idle')
          break
        case 'download-progress':
          setUpdateStatus('downloading')
          setDownloadProgress(data.data?.percent || 0)
          break
        case 'update-downloaded':
          setUpdateStatus('ready')
          break
        case 'update-error':
          setUpdateStatus('idle')
          break
      }
    })

    return () => unsubscribe?.()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement global search functionality
    console.log('Searching for:', searchQuery)
  }

  const handleNewAccount = () => {
    console.log('🔥 handleNewAccount clicked!')
    console.log('onAddAccount:', onAddAccount)

    if (onAddAccount) {
      console.log('🔥 Calling onAddAccount callback')
      onAddAccount()
    } else {
      console.log('🔥 Navigating to /accounts')
      navigate('/accounts')
    }
  }

  const handleImportData = () => {
    console.log('🔥 handleImportData clicked!')

    // Trigger import functionality
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        console.log('🔥 File selected:', file.name)
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string)
            console.log('🔥 Imported data:', data)
            // Handle import logic here
          } catch (error) {
            console.error('🔥 Import error:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleExportData = () => {
    console.log('🔥 handleExportData clicked!')

    // Export current data
    const data = {
      accounts: JSON.parse(localStorage.getItem('zalo-accounts') || '[]'),
      settings: JSON.parse(localStorage.getItem('zalo-settings') || '{}'),
      exportDate: new Date().toISOString()
    }

    console.log('🔥 Export data:', data)

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zalo-manager-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    console.log('🔥 Export completed!')
  }

  const handleSettings = () => {
    console.log('🔥 handleSettings clicked!')
    navigate('/settings')
  }

  const handleCheckUpdate = async () => {
    const api = (window as any).electronAPI
    if (!api?.updater) {
      toast.error('Tính năng cập nhật không khả dụng')
      return
    }
    
    setUpdateStatus('checking')
    toast.loading('Đang kiểm tra cập nhật...', { id: 'check-update' })
    
    try {
      const result = await api.updater.checkForUpdates()
      toast.dismiss('check-update')
      
      if (!result.success) {
        toast.error(`Lỗi: ${result.error}`)
        setUpdateStatus('idle')
      } else if (result.updateInfo?.version) {
        // Update available - status will be set by event listener
      } else {
        toast.success('Bạn đang sử dụng phiên bản mới nhất!')
        setUpdateStatus('idle')
      }
    } catch (error) {
      toast.dismiss('check-update')
      toast.error('Không thể kiểm tra cập nhật')
      setUpdateStatus('idle')
    }
  }

  const handleDownloadUpdate = async () => {
    const api = (window as any).electronAPI
    if (!api?.updater) return
    
    toast.loading('Đang tải bản cập nhật...', { id: 'download-update' })
    
    try {
      const result = await api.updater.downloadUpdate()
      toast.dismiss('download-update')
      
      if (!result.success) {
        toast.error(`Lỗi tải: ${result.error}`)
        setUpdateStatus('available')
      }
    } catch (error) {
      toast.dismiss('download-update')
      toast.error('Không thể tải bản cập nhật')
      setUpdateStatus('available')
    }
  }

  const handleInstallUpdate = () => {
    const api = (window as any).electronAPI
    if (!api?.updater) return
    
    if (window.confirm('Ứng dụng sẽ khởi động lại để cài đặt bản cập nhật. Bạn có muốn tiếp tục?')) {
      api.updater.installUpdate()
    }
  }

  // Render update button based on status
  const renderUpdateButton = () => {
    switch (updateStatus) {
      case 'checking':
        return (
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="p-2"
            title="Đang kiểm tra..."
          >
            <RefreshCw className="w-5 h-5 animate-spin text-primary-500" />
          </Button>
        )
      
      case 'available':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadUpdate}
            className="p-2 relative"
            title={`Tải bản cập nhật v${updateVersion}`}
          >
            <ArrowDownCircle className="w-5 h-5 text-primary-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
          </Button>
        )
      
      case 'downloading':
        return (
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="p-2 relative"
            title={`Đang tải ${downloadProgress.toFixed(0)}%`}
          >
            <RefreshCw className="w-5 h-5 animate-spin text-primary-500" />
            <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-[10px] text-primary-600 font-medium">
              {downloadProgress.toFixed(0)}%
            </span>
          </Button>
        )
      
      case 'ready':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInstallUpdate}
            className="p-2 relative"
            title="Cài đặt và khởi động lại"
          >
            <CheckCircle className="w-5 h-5 text-success-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-success-500 rounded-full animate-pulse" />
          </Button>
        )
      
      default:
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckUpdate}
            className="p-2"
            title="Kiểm tra cập nhật"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        )
    }
  }

  return (
    <header className="h-16 bg-white dark:bg-secondary-800 border-b border-secondary-200 dark:border-secondary-700 flex items-center justify-between px-4">
      {/* Left section */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="p-2"
          aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Search */}
        <form onSubmit={handleSearch} className="hidden md:block">
          <div className="relative">
            <Input
              type="text"
              placeholder="Tìm kiếm tài khoản, bạn bè, nhóm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="w-80"
            />
          </div>
        </form>
      </div>

      {/* Right section */}
      <div className="flex items-center space-x-2">
        {/* Quick actions */}
        <div className="hidden lg:flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewAccount}
            icon={<Plus className="w-4 h-4" />}
          >
            Tài khoản mới
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImportData}
            icon={<Upload className="w-4 h-4" />}
            title="Import dữ liệu"
          />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportData}
            icon={<Download className="w-4 h-4" />}
            title="Export dữ liệu"
          />
        </div>

        {/* Update button */}
        {renderUpdateButton()}

        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 relative"
            aria-label="Thông báo"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <Badge 
                variant="error" 
                size="sm"
                className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </Badge>
            )}
          </Button>

          {/* Notifications dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-large border border-secondary-200 z-50">
              <div className="p-4 border-b border-secondary-200">
                <h3 className="text-sm font-semibold text-secondary-900">
                  Thông báo
                </h3>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 border-b border-secondary-100 hover:bg-secondary-50 transition-colors"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                          notification.type === 'success' ? 'bg-success-500' :
                          notification.type === 'error' ? 'bg-error-500' :
                          notification.type === 'warning' ? 'bg-warning-500' :
                          'bg-primary-500'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-900">
                            {notification.title}
                          </p>
                          <p className="text-xs text-secondary-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-secondary-400 mt-1">
                            {new Date(notification.createdAt).toLocaleTimeString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-secondary-400 mx-auto mb-2" />
                    <p className="text-sm text-secondary-500">
                      Không có thông báo mới
                    </p>
                  </div>
                )}
              </div>
              
              {notifications.length > 5 && (
                <div className="p-3 border-t border-secondary-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                  >
                    Xem tất cả thông báo
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSettings}
          className="p-2"
          aria-label="Cài đặt"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Click outside to close notifications */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </header>
  )
}

export { Header }
