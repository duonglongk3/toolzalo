import React from 'react'
import { Plus, Edit, Trash2, Power, PowerOff, Eye, EyeOff, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Modal, Input } from '@/components/ui'
import { useAccountStore } from '@/store'
import { formatRelativeTime, cn } from '@/utils'
import { zaloService } from '@/services'
import type { ZaloAccount } from '@/types'
import toast from 'react-hot-toast'
import { useSearchParams, useNavigate } from 'react-router-dom'

const Accounts: React.FC = () => {
  console.log('🔥 Accounts component rendered')
  const { accounts, activeAccount, addAccount, updateAccount, deleteAccount, setActiveAccount } = useAccountStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [editingAccount, setEditingAccount] = React.useState<ZaloAccount | null>(null)
  const [showPassword, setShowPassword] = React.useState<Record<string, boolean>>({})
  const [testingConnection, setTestingConnection] = React.useState<Record<string, boolean>>({})

  // Check URL params to auto-open modal
  React.useEffect(() => {
    const action = searchParams.get('action')
    console.log('🔥 Accounts page - URL action:', action)
    if (action === 'add') {
      console.log('🔥 Opening add modal from URL parameter')
      setShowAddModal(true)
      // Clear the URL parameter
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      navigate({ search: newParams.toString() }, { replace: true })
    }
  }, [searchParams, navigate])

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    imei: '',
    cookie: '',
    userAgent: ''
  })

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      imei: '',
      cookie: '',
      userAgent: ''
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔥 handleSubmit called with:', formData)

    if (!formData.name || !formData.phone || !formData.imei || !formData.cookie || !formData.userAgent) {
      console.log('🔥 Form validation failed - missing fields')
      toast.error('Vui lòng điền đầy đủ thông tin')
      return
    }

    try {
      if (editingAccount) {
        updateAccount(editingAccount.id, {
          ...formData,
          status: 'offline' // Reset status when updating credentials
        })
        toast.success('Cập nhật tài khoản thành công')
        setEditingAccount(null)
      } else {
        addAccount({
          ...formData,
          status: 'offline'
        })
        toast.success('Thêm tài khoản thành công')
      }
      
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Account operation error:', error)
      toast.error('Có lỗi xảy ra, vui lòng thử lại')
    }
  }

  const handleEdit = (account: ZaloAccount) => {
    setFormData({
      name: account.name,
      phone: account.phone,
      imei: account.imei,
      cookie: account.cookie,
      userAgent: account.userAgent
    })
    setEditingAccount(account)
    setShowAddModal(true)
  }

  const handleDelete = (account: ZaloAccount) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${account.name}"?`)) {
      deleteAccount(account.id)
      toast.success('Xóa tài khoản thành công')
    }
  }

  const handleSetActive = (account: ZaloAccount) => {
    setActiveAccount(account)
    // Simulate login process
    updateAccount(account.id, { 
      status: 'online',
      lastLogin: new Date()
    })
    toast.success(`Đã chuyển sang tài khoản "${account.name}"`)
  }

  const handleToggleStatus = (account: ZaloAccount) => {
    const newStatus = account.status === 'online' ? 'offline' : 'online'
    updateAccount(account.id, { 
      status: newStatus,
      lastLogin: newStatus === 'online' ? new Date() : account.lastLogin
    })
    toast.success(`Đã ${newStatus === 'online' ? 'kích hoạt' : 'tắt'} tài khoản`)
  }

  const togglePasswordVisibility = (accountId: string) => {
    setShowPassword(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }))
  }

  const handleTestConnection = async (account: ZaloAccount) => {
    setTestingConnection(prev => ({ ...prev, [account.id]: true }))

    try {
      const success = await zaloService.login({
        imei: account.imei,
        cookie: account.cookie,
        userAgent: account.userAgent
      })

      if (success) {
        updateAccount(account.id, {
          status: 'online',
          lastLogin: new Date()
        })
        toast.success('Kết nối thành công!')

        // Get account info to verify
        const accountInfo = await zaloService.getAccountInfo()
        if (accountInfo) {
          console.log('Account info:', accountInfo)
        }
      } else {
        updateAccount(account.id, { status: 'error' })
        toast.error('Không thể kết nối. Vui lòng kiểm tra thông tin đăng nhập.')
      }
    } catch (error) {
      console.error('Connection test error:', error)
      updateAccount(account.id, { status: 'error' })
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setTestingConnection(prev => ({ ...prev, [account.id]: false }))
    }
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingAccount(null)
    resetForm()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Quản lý tài khoản Zalo</h1>
          <p className="text-secondary-600 mt-1">
            Thêm và quản lý các tài khoản Zalo của bạn
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          Thêm tài khoản
        </Button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <Card key={account.id} className={cn(
            'transition-all duration-200',
            activeAccount?.id === account.id && 'ring-2 ring-primary-500 bg-primary-50'
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{account.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={
                      account.status === 'online' ? 'success' :
                      account.status === 'offline' ? 'default' :
                      'error'
                    }
                  >
                    {account.status === 'online' ? 'Trực tuyến' :
                     account.status === 'offline' ? 'Ngoại tuyến' :
                     'Lỗi'}
                  </Badge>
                  {activeAccount?.id === account.id && (
                    <Badge variant="info">Đang dùng</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-secondary-500">Số điện thoại</p>
                  <p className="text-sm font-medium text-secondary-900">{account.phone}</p>
                </div>
                
                <div>
                  <p className="text-xs text-secondary-500">IMEI</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-mono text-secondary-900">
                      {showPassword[account.id] 
                        ? account.imei 
                        : '••••••••••••••••'
                      }
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePasswordVisibility(account.id)}
                      className="p-1"
                    >
                      {showPassword[account.id] ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-secondary-500">Đăng nhập lần cuối</p>
                  <p className="text-sm text-secondary-700">
                    {account.lastLogin 
                      ? formatRelativeTime(account.lastLogin)
                      : 'Chưa đăng nhập'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-secondary-200">
                {activeAccount?.id !== account.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetActive(account)}
                    className="flex-1"
                  >
                    Chọn làm chính
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTestConnection(account)}
                  loading={testingConnection[account.id]}
                  className="p-2"
                  title="Test kết nối"
                >
                  <Power className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleStatus(account)}
                  className="p-2"
                  title={account.status === 'online' ? 'Tắt' : 'Kích hoạt'}
                >
                  {account.status === 'online' ? (
                    <PowerOff className="w-4 h-4" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(account)}
                  className="p-2"
                  title="Chỉnh sửa"
                >
                  <Edit className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(account)}
                  className="p-2 text-error-600 hover:text-error-700 hover:bg-error-50"
                  title="Xóa"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {accounts.length === 0 && (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-secondary-400" />
                </div>
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  Chưa có tài khoản nào
                </h3>
                <p className="text-secondary-600 mb-4">
                  Thêm tài khoản Zalo đầu tiên để bắt đầu sử dụng
                </p>
                <Button onClick={() => setShowAddModal(true)}>
                  Thêm tài khoản đầu tiên
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add/Edit Account Modal */}
      {(() => {
        console.log('🔥 Rendering Modal - showAddModal:', showAddModal)
        return null
      })()}
      <Modal
        open={showAddModal}
        onClose={closeModal}
        title={editingAccount ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Tên tài khoản"
              placeholder="Nhập tên hiển thị"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            
            <Input
              label="Số điện thoại"
              placeholder="0xxxxxxxxx"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              required
            />
          </div>
          
          <Input
            label="IMEI"
            placeholder="Nhập IMEI của thiết bị"
            value={formData.imei}
            onChange={(e) => setFormData(prev => ({ ...prev, imei: e.target.value }))}
            required
          />
          
          <Input
            label="Cookie"
            placeholder="Nhập cookie từ trình duyệt"
            value={formData.cookie}
            onChange={(e) => setFormData(prev => ({ ...prev, cookie: e.target.value }))}
            required
          />
          
          <Input
            label="User Agent"
            placeholder="Nhập User Agent từ trình duyệt"
            value={formData.userAgent}
            onChange={(e) => setFormData(prev => ({ ...prev, userAgent: e.target.value }))}
            required
          />

          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
            >
              Hủy
            </Button>
            <Button type="submit">
              {editingAccount ? 'Cập nhật' : 'Thêm tài khoản'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Accounts
