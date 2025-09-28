import React from 'react'
import {
  Menu,
  Bell,
  Search,
  Plus,
  Download,
  Upload,
  Settings
} from 'lucide-react'
import { Button, Input, Badge } from '@/components/ui'
import { useAppStore } from '@/store'
import { cn } from '@/utils'
import { useNavigate } from 'react-router-dom'

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

  const unreadNotifications = notifications.filter(n => !n.id.includes('read')).length

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
