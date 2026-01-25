import React from 'react'
import { 
  Users, 
  MessageSquare, 
  Users2, 
  Zap,
  TrendingUp,
  Activity,
  Clock
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { useFriendsStore, useGroupsStore, useAppStore } from '@/store'
import { useAccountStore } from '@/store/database-store'
import { formatNumber, formatRelativeTime } from '@/utils'

const Dashboard: React.FC = () => {
  const { accounts, activeAccount } = useAccountStore()
  const { friends } = useFriendsStore()
  const { groups } = useGroupsStore()
  const { tasks } = useAppStore()

  // Calculate statistics
  const stats = {
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter(acc => acc.status === 'online').length,
    totalFriends: friends.length,
    totalGroups: groups.length,
    activeTasks: tasks.filter(task => task.status === 'running').length,
    completedTasks: tasks.filter(task => task.status === 'completed').length
  }

  const recentActivity = [
    {
      id: '1',
      type: 'account_login',
      message: 'Đăng nhập tài khoản thành công',
      account: activeAccount?.name || 'Unknown',
      timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      status: 'success'
    },
    {
      id: '2',
      type: 'friend_sync',
      message: 'Đồng bộ danh sách bạn bè',
      account: activeAccount?.name || 'Unknown',
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      status: 'success'
    },
    {
      id: '3',
      type: 'group_join',
      message: 'Tham gia nhóm mới',
      account: activeAccount?.name || 'Unknown',
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      status: 'info'
    }
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Tổng quan</h1>
        <p className="text-secondary-600 mt-1">
          Quản lý và theo dõi hoạt động Zalo của bạn
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">Tài khoản</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {formatNumber(stats.totalAccounts)}
                </p>
                <p className="text-xs text-success-600 mt-1">
                  {stats.activeAccounts} đang hoạt động
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">Bạn bè</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {formatNumber(stats.totalFriends)}
                </p>
                <p className="text-xs text-secondary-500 mt-1">
                  Tổng số bạn bè
                </p>
              </div>
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">Nhóm</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {formatNumber(stats.totalGroups)}
                </p>
                <p className="text-xs text-secondary-500 mt-1">
                  Đã tham gia
                </p>
              </div>
              <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                <Users2 className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">Tác vụ</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {formatNumber(stats.activeTasks)}
                </p>
                <p className="text-xs text-success-600 mt-1">
                  {stats.completedTasks} hoàn thành
                </p>
              </div>
              <div className="w-12 h-12 bg-info-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-info-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Account Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Tài khoản hiện tại</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAccount ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      activeAccount.status === 'online' ? 'bg-success-500' :
                      activeAccount.status === 'offline' ? 'bg-secondary-400' :
                      'bg-error-500'
                    }`} />
                    <div>
                      <p className="font-medium text-secondary-900">
                        {activeAccount.name}
                      </p>
                      <p className="text-sm text-secondary-600">
                        {activeAccount.phone}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      activeAccount.status === 'online' ? 'success' :
                      activeAccount.status === 'offline' ? 'default' :
                      'error'
                    }
                  >
                    {activeAccount.status === 'online' ? 'Trực tuyến' :
                     activeAccount.status === 'offline' ? 'Ngoại tuyến' :
                     'Lỗi'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-secondary-200">
                  <div>
                    <p className="text-xs text-secondary-500">Đăng nhập lần cuối</p>
                    <p className="text-sm font-medium text-secondary-900">
                      {activeAccount.lastLogin 
                        ? formatRelativeTime(activeAccount.lastLogin)
                        : 'Chưa xác định'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-secondary-500">Trạng thái</p>
                    <p className="text-sm font-medium text-secondary-900">
                      Hoạt động bình thường
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="w-12 h-12 text-secondary-400 mx-auto mb-3" />
                <p className="text-secondary-600">Chưa có tài khoản nào được chọn</p>
                <p className="text-sm text-secondary-500 mt-1">
                  Vui lòng thêm và chọn tài khoản để bắt đầu
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Hoạt động gần đây</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    activity.status === 'success' ? 'bg-success-500' :
                    activity.status === 'error' ? 'bg-error-500' :
                    'bg-primary-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900">
                      {activity.message}
                    </p>
                    <p className="text-xs text-secondary-600">
                      {activity.account}
                    </p>
                    <p className="text-xs text-secondary-400 mt-1">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              
              {recentActivity.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-secondary-400 mx-auto mb-3" />
                  <p className="text-secondary-600">Chưa có hoạt động nào</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Thao tác nhanh</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-secondary-900">Gửi tin nhắn</p>
                  <p className="text-sm text-secondary-600">Gửi tin nhắn hàng loạt</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <p className="font-medium text-secondary-900">Thêm bạn bè</p>
                  <p className="text-sm text-secondary-600">Thêm bạn hàng loạt</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
                  <Users2 className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <p className="font-medium text-secondary-900">Quét nhóm</p>
                  <p className="text-sm text-secondary-600">Lấy danh sách thành viên</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
