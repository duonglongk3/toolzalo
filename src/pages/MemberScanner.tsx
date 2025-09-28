import React from 'react'
import { Search, Download, FileSpreadsheet, Users, Filter, RefreshCw, Eye } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Modal, Input } from '@/components/ui'
import { useGroupsStore, useAccountStore } from '@/store'
import { formatRelativeTime } from '@/utils'
import { zaloService } from '@/services'
import type { ZaloGroup } from '@/types'
import toast from 'react-hot-toast'

interface GroupMember {
  id: string
  name: string
  displayName: string
  phone?: string
  avatar?: string
  isAdmin: boolean
  joinedAt?: Date
  lastActive?: Date
}

interface ScanResult {
  id: string
  groupId: string
  groupName: string
  members: GroupMember[]
  scannedAt: Date
  totalMembers: number
}

const MemberScanner: React.FC = () => {
  const { groups } = useGroupsStore()
  const { activeAccount } = useAccountStore()
  const [scanResults, setScanResults] = React.useState<ScanResult[]>([])
  const [selectedGroup, setSelectedGroup] = React.useState<ZaloGroup | null>(null)
  const [showMembersModal, setShowMembersModal] = React.useState(false)
  const [currentMembers, setCurrentMembers] = React.useState<GroupMember[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [filterRole, setFilterRole] = React.useState<'all' | 'admin' | 'member'>('all')

  const handleScanGroup = async (group: ZaloGroup) => {
    if (!activeAccount) {
      toast.error('Vui lòng chọn tài khoản trước')
      return
    }

    if (!zaloService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập tài khoản trước')
      return
    }

    setLoading(true)
    try {
      const members = await zaloService.getGroupMembers(group.id)
      
      if (members && members.length > 0) {
        const processedMembers: GroupMember[] = members.map((member: any) => ({
          id: member.id || member.userId || crypto.randomUUID(),
          name: member.name || member.displayName || 'Không có tên',
          displayName: member.displayName || member.name || 'Không có tên',
          phone: member.phone,
          avatar: member.avatar,
          isAdmin: member.isAdmin || false,
          joinedAt: member.joinedAt ? new Date(member.joinedAt) : undefined,
          lastActive: member.lastActive ? new Date(member.lastActive) : undefined
        }))

        const scanResult: ScanResult = {
          id: crypto.randomUUID(),
          groupId: group.id,
          groupName: group.name,
          members: processedMembers,
          scannedAt: new Date(),
          totalMembers: processedMembers.length
        }

        setScanResults(prev => [scanResult, ...prev.filter(r => r.groupId !== group.id)])
        toast.success(`Đã quét ${processedMembers.length} thành viên từ nhóm "${group.name}"`)
      } else {
        toast.error('Không thể lấy danh sách thành viên hoặc nhóm trống')
      }
    } catch (error) {
      console.error('Scan group members error:', error)
      toast.error('Lỗi khi quét thành viên nhóm')
    } finally {
      setLoading(false)
    }
  }

  const handleViewMembers = (result: ScanResult) => {
    setCurrentMembers(result.members)
    setSelectedGroup(groups.find(g => g.id === result.groupId) || null)
    setShowMembersModal(true)
  }

  const handleExportCSV = (result: ScanResult) => {
    try {
      const headers = ['STT', 'Tên', 'Tên hiển thị', 'Số điện thoại', 'Vai trò', 'Ngày tham gia', 'Hoạt động cuối']
      const rows = result.members.map((member, index) => [
        index + 1,
        member.name,
        member.displayName,
        member.phone || 'Không có',
        member.isAdmin ? 'Admin' : 'Thành viên',
        member.joinedAt ? member.joinedAt.toLocaleDateString('vi-VN') : 'Không rõ',
        member.lastActive ? member.lastActive.toLocaleDateString('vi-VN') : 'Không rõ'
      ])

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `thanh_vien_${result.groupName}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Đã xuất file CSV thành công')
    } catch (error) {
      console.error('Export CSV error:', error)
      toast.error('Lỗi khi xuất file CSV')
    }
  }

  const handleExportJSON = (result: ScanResult) => {
    try {
      const exportData = {
        groupInfo: {
          id: result.groupId,
          name: result.groupName,
          scannedAt: result.scannedAt,
          totalMembers: result.totalMembers
        },
        members: result.members
      }

      const jsonContent = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `thanh_vien_${result.groupName}_${new Date().toISOString().split('T')[0]}.json`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Đã xuất file JSON thành công')
    } catch (error) {
      console.error('Export JSON error:', error)
      toast.error('Lỗi khi xuất file JSON')
    }
  }

  const filteredMembers = React.useMemo(() => {
    let filtered = currentMembers

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(member => 
        member.name.toLowerCase().includes(query) ||
        member.displayName.toLowerCase().includes(query) ||
        member.phone?.includes(searchQuery)
      )
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(member => 
        filterRole === 'admin' ? member.isAdmin : !member.isAdmin
      )
    }

    return filtered
  }, [currentMembers, searchQuery, filterRole])

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Quét thành viên nhóm</h1>
          <p className="text-secondary-600 mt-1">
            Lấy danh sách thành viên từ các nhóm và xuất dữ liệu
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Nhóm có thể quét</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {groups.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <Search className="w-5 h-5 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Đã quét</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {scanResults.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <Users className="w-5 h-5 text-info-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Tổng thành viên</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {scanResults.reduce((sum, result) => sum + result.totalMembers, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Download className="w-5 h-5 text-warning-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Đã xuất file</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {scanResults.length * 2}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách nhóm</CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">
                Chưa có nhóm nào
              </h3>
              <p className="text-secondary-600 mb-4">
                Vui lòng tham gia nhóm trước khi quét thành viên
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const scanResult = scanResults.find(r => r.groupId === group.id)
                
                return (
                  <Card key={group.id} className="border border-secondary-200">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3 mb-3">
                        {group.avatar ? (
                          <img
                            src={group.avatar}
                            alt={group.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-secondary-200 rounded-lg flex items-center justify-center">
                            <Users className="w-6 h-6 text-secondary-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-secondary-900 truncate">
                            {group.name}
                          </h3>
                          <p className="text-sm text-secondary-600">
                            {group.memberCount} thành viên
                          </p>
                          {scanResult && (
                            <p className="text-xs text-success-600">
                              Đã quét: {formatRelativeTime(scanResult.scannedAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleScanGroup(group)}
                          loading={loading}
                          className="flex-1"
                          icon={<Search className="w-4 h-4" />}
                        >
                          {scanResult ? 'Quét lại' : 'Quét'}
                        </Button>
                        
                        {scanResult && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewMembers(scanResult)}
                            className="p-2"
                            title="Xem thành viên"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả quét</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scanResults.map((result) => (
                <div key={result.id} className="border border-secondary-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-secondary-900">{result.groupName}</h4>
                      <p className="text-sm text-secondary-600">
                        {result.totalMembers} thành viên • Quét: {formatRelativeTime(result.scannedAt)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewMembers(result)}
                        icon={<Eye className="w-4 h-4" />}
                      >
                        Xem
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportCSV(result)}
                        icon={<FileSpreadsheet className="w-4 h-4" />}
                      >
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportJSON(result)}
                        icon={<Download className="w-4 h-4" />}
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-secondary-600">
                    <span>Admin: {result.members.filter(m => m.isAdmin).length}</span>
                    <span>Thành viên: {result.members.filter(m => !m.isAdmin).length}</span>
                    <span>Có SĐT: {result.members.filter(m => m.phone).length}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members Modal */}
      <Modal
        open={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        title={`Thành viên nhóm: ${selectedGroup?.name || ''}`}
        size="xl"
      >
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Tìm kiếm thành viên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              className="px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Admin</option>
              <option value="member">Thành viên</option>
            </select>
          </div>

          {/* Members List */}
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {filteredMembers.map((member, index) => (
                <div key={member.id} className="flex items-center space-x-3 p-3 border border-secondary-200 rounded-lg">
                  <div className="w-8 h-8 bg-secondary-200 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-secondary-300 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-secondary-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-secondary-900 truncate">
                        {member.displayName}
                      </h4>
                      {member.isAdmin && (
                        <Badge variant="success" className="text-xs">Admin</Badge>
                      )}
                    </div>
                    <p className="text-sm text-secondary-600 truncate">
                      {member.name !== member.displayName && member.name}
                    </p>
                    {member.phone && (
                      <p className="text-sm text-secondary-500">{member.phone}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-secondary-500">
                    {member.joinedAt && (
                      <p>Tham gia: {member.joinedAt.toLocaleDateString('vi-VN')}</p>
                    )}
                    {member.lastActive && (
                      <p>Hoạt động: {member.lastActive.toLocaleDateString('vi-VN')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-secondary-600">
              Hiển thị {filteredMembers.length} / {currentMembers.length} thành viên
            </p>
            <Button
              variant="outline"
              onClick={() => setShowMembersModal(false)}
            >
              Đóng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default MemberScanner
