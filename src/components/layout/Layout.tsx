import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAppStore } from '@/store'
import { useAccountStore } from '@/store/database-store'
import { zaloService } from '@/services'

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const navigate = useNavigate()
  const { config } = useAppStore()
  const { accounts, activeAccount, setActiveAccount, loadAccounts, updateAccount } = useAccountStore()
  const [autoLoginAttempted, setAutoLoginAttempted] = React.useState(false)

  // Auto-login với tài khoản đã lưu khi app khởi động
  React.useEffect(() => {
    const performAutoLogin = async () => {
      // Chỉ chạy 1 lần
      if (autoLoginAttempted) return
      setAutoLoginAttempted(true)

      // Load accounts từ database
      await loadAccounts()
    }
    performAutoLogin()
  }, [loadAccounts, autoLoginAttempted])

  // Auto-login khi có accounts và chưa đăng nhập Zalo API
  React.useEffect(() => {
    const autoLogin = async () => {
      // Kiểm tra xem đã có zaloAPI chưa
      const isLoggedIn = await zaloService.refreshLoginState()
      if (isLoggedIn) {
        console.log('✅ Zalo API already logged in')
        return
      }

      // Tìm tài khoản để auto-login: ưu tiên activeAccount, sau đó tài khoản online, cuối cùng là tài khoản đầu tiên
      let accountToLogin = activeAccount
      if (!accountToLogin) {
        accountToLogin = accounts.find(acc => acc.status === 'online') || accounts[0]
      }

      if (!accountToLogin || !accountToLogin.cookie || !accountToLogin.imei || !accountToLogin.userAgent) {
        console.log('⚠️ No valid account for auto-login')
        return
      }

      console.log('🔄 Auto-logging in with account:', accountToLogin.name)
      
      try {
        const success = await zaloService.login({
          imei: accountToLogin.imei,
          cookie: accountToLogin.cookie,
          userAgent: accountToLogin.userAgent,
        })

        if (success) {
          console.log('✅ Auto-login successful')
          // Cập nhật trạng thái
          await updateAccount(accountToLogin.id, {
            status: 'online',
            lastLogin: new Date()
          })
          // Set làm active account nếu chưa có
          if (!activeAccount) {
            setActiveAccount(accountToLogin)
          }
          toast.success(`Đã tự động đăng nhập: ${accountToLogin.name}`)
        } else {
          console.log('❌ Auto-login failed')
          await updateAccount(accountToLogin.id, { status: 'error' })
        }
      } catch (error) {
        console.error('Auto-login error:', error)
        await updateAccount(accountToLogin.id, { status: 'error' })
      }
    }

    // Chỉ auto-login khi đã load xong accounts
    if (autoLoginAttempted && accounts.length > 0) {
      autoLogin()
    }
  }, [autoLoginAttempted, accounts, activeAccount, updateAccount, setActiveAccount])

  // Apply theme (light/dark/system)
  React.useEffect(() => {
    const root = document.documentElement
    const apply = (mode: 'light'|'dark') => {
      if (mode === 'dark') root.classList.add('dark')
      else root.classList.remove('dark')
    }
    if (config.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light')
      mq.addEventListener?.('change', handler)
      return () => mq.removeEventListener?.('change', handler)
    } else {
      apply(config.theme)
    }
  }, [config.theme])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const handleAddAccount = () => {
    // Navigate to accounts page and trigger add modal
    navigate('/accounts?action=add')
  }

  return (
    <div className="flex h-screen bg-secondary-50">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          onAddAccount={handleAddAccount}
        />
        
        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  )
}

export { Layout }
