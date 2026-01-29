import React from 'react'
import { Plus, Search, Filter, Download, Upload, UserPlus, Trash2, Tag } from 'lucide-react'
import { Button, Card, CardContent, Badge, Modal, Input } from '@/components/ui'
import { useFriendsStore } from '@/store'
import { useAccountStore } from '@/store/database-store'
import { formatRelativeTime } from '@/utils'
import { zaloService } from '@/services'
import type { ZaloFriend } from '@/types'
import toast from 'react-hot-toast'

const Friends: React.FC = () => {
  const { friends, addFriend, setFriends, deleteFriend, addFriendTag, removeFriendTag } = useFriendsStore()
  const { activeAccount } = useAccountStore()
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [showBulkAddModal, setShowBulkAddModal] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedTag, setSelectedTag] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [labels, setLabels] = React.useState<Array<{ id: number; text: string; conversations: string[] }>>([])
  // Hiển thị danh sách nếu đã có friends (persist từ store)
  const showList = friends.length > 0
  // Trạng thái tiến trình thêm bạn hàng loạt
  const [bulkRunning, setBulkRunning] = React.useState(false)
  const [bulkPhase, setBulkPhase] = React.useState<'idle'|'resolve'|'send'>('idle')
  const [bulkIndex, setBulkIndex] = React.useState(0)
  const [bulkTotal, setBulkTotal] = React.useState(0)
  const [statSent, setStatSent] = React.useState(0)
  const [statAlready, setStatAlready] = React.useState(0)
  const [statFailed, setStatFailed] = React.useState(0)
  const [statResolved, setStatResolved] = React.useState(0)
  // Tối ưu: dùng memo để suy diễn tags từ labels, không ghi vào store để tránh re-render hàng loạt

  // Form states
  const [phoneNumber, setPhoneNumber] = React.useState('')
  const [friendMessage, setFriendMessage] = React.useState('Xin chào, mình muốn kết bạn với bạn!')
  const [bulkPhones, setBulkPhones] = React.useState('')
  const [bulkUserIds, setBulkUserIds] = React.useState('')
  const [bulkMessage, setBulkMessage] = React.useState('Xin chào, mình muốn kết bạn với bạn!')
  // Đơn vị hiển thị: giây; lưu/convert khi gọi API -> ms
  const [bulkDelaySec, setBulkDelaySec] = React.useState<string>('30')

  React.useEffect(() => {
    // Đồng bộ trạng thái đăng nhập từ main process khi vào trang
    zaloService.refreshLoginState().catch(() => {})
    // Tải nhãn từ Zalo và đồng bộ tag cục bộ
    ;(async () => {
      const res = await zaloService.getLabels()
      if (res) {
        setLabels(res.labelData.map((l: any) => ({ id: l.id, text: l.text, conversations: l.conversations })))
      }
    })()
  }, [])

  // Debounce tìm kiếm để giảm số lần lọc
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Suy diễn map friendId -> tags từ labels (O(n) theo số conv trong labels)
  const friendTagsMap = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const l of labels) {
      for (const id of l.conversations || []) {
        const arr = map.get(id) || []
        arr.push(l.text)
        map.set(id, arr)
      }
    }
    return map
  }, [labels])

  // Get filtered friends (lọc theo debouncedQuery + selectedTag từ map)
  const filteredFriends = React.useMemo(() => {
    let result = friends

    const q = debouncedQuery.trim().toLowerCase()
    if (q) {
      result = friends.filter((f) =>
        (f.name?.toLowerCase().includes(q) || f.displayName?.toLowerCase().includes(q) || f.phone?.includes(debouncedQuery))
      )
    }

    if (selectedTag) {
      result = result.filter(friend => (friendTagsMap.get(friend.id) || []).includes(selectedTag))
    }

    return result
  }, [friends, debouncedQuery, selectedTag, friendTagsMap])

  // Tags từ Zalo Labels
  const allTags = React.useMemo(() => labels.map(l => l.text).sort((a,b)=>a.localeCompare(b)), [labels])

  const handleSyncFriends = async () => {
    console.log('🔥 handleSyncFriends called!')

    if (!activeAccount) {
      console.log('🔥 No active account')
      toast.error('Vui lòng chọn tài khoản trước')
      return
    }

    // Đồng bộ lại trạng thái đăng nhập từ main để tránh sai lệch
    await zaloService.refreshLoginState()
    if (!zaloService.isLoggedIn()) {
      console.log('🔥 Zalo service not logged in -> trying auto login with active account')
      if (activeAccount) {
        const loadingId = 'auto-login'
        toast.loading('Đang đăng nhập tự động...', { id: loadingId })
        const ok = await zaloService.login({
          imei: activeAccount.imei,
          cookie: activeAccount.cookie,
          userAgent: activeAccount.userAgent,
        } as any)
        toast.dismiss(loadingId)
        if (!ok) {
          toast.error('Đăng nhập tự động thất bại, vui lòng kiểm tra thông tin tài khoản')
          return
        }
      } else {
        toast.error('Vui lòng chọn tài khoản trước')
        return
      }
    }

    console.log('🔥 Starting sync friends...')
    setLoading(true)
    try {
      const friendsList = await zaloService.getAllFriends()
      console.log('🔥 Friends list received:', friendsList.length)

      // Thay thế toàn bộ danh sách từ Zalo (tránh trùng lặp do id cũ tạo ngẫu nhiên)
      setFriends(friendsList)

      // Sau khi đồng bộ bạn bè, đồng bộ nhãn -> tag
      const res = await zaloService.getLabels()
      if (res) {
        setLabels(res.labelData.map((l: any) => ({ id: l.id, text: l.text, conversations: l.conversations })))
      }

      toast.success(`Đã đồng bộ ${friendsList.length} bạn bè`)
    } catch (error) {
      console.error('🔥 Sync friends error:', error)
      toast.error('Lỗi đồng bộ danh sách bạn bè')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSingleFriend = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Vui lòng nhập số điện thoại')
      return
    }

    if (!activeAccount) {
      toast.error('Vui lòng chọn tài khoản trước')
      return
    }

    setLoading(true)
    try {
      const success = await zaloService.addFriend(phoneNumber.trim(), friendMessage.trim())

      if (success) {
        // Add to local store
        addFriend({
          name: phoneNumber.trim(),
          displayName: phoneNumber.trim(),
          phone: phoneNumber.trim(),
          status: 'unknown',
          tags: []
        })

        toast.success('Đã gửi lời mời kết bạn')
        setPhoneNumber('')
        setShowAddModal(false)
      } else {
        toast.error('Không thể gửi lời mời kết bạn')
      }
    } catch (error) {
      console.error('Add friend error:', error)
      toast.error('Lỗi khi thêm bạn bè')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkAddFriends = async () => {
    const phoneNumbers = bulkPhones
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    const userIds = bulkUserIds
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    if (phoneNumbers.length === 0 && userIds.length === 0) {
      toast.error('Vui lòng nhập danh sách số điện thoại hoặc userId')
      return
    }

    if (!activeAccount) {
      toast.error('Vui lòng chọn tài khoản trước')
      return
    }

    // Đảm bảo đã đăng nhập Zalo trước khi gửi lời mời
    const logged = await zaloService.refreshLoginState()
    if (!logged) {
      toast.error('Vui lòng đăng nhập Zalo trước')
      return
    }

    const delayMs = Math.max(0, Math.min(600000, (parseInt(bulkDelaySec || '30', 10) || 30) * 1000))

    // Khởi tạo tiến trình
    setBulkRunning(true)
    setBulkPhase('resolve')
    setBulkIndex(0)
    setBulkTotal(phoneNumbers.filter(s=>s.trim()).length)
    setStatSent(0); setStatAlready(0); setStatFailed(0); setStatResolved(0)

    setLoading(true)
    try {
      const result = await zaloService.addFriendsBulkAdvanced(
        phoneNumbers,
        userIds,
        delayMs,
        bulkMessage.trim(),
        (p) => {
          if (p.phase === 'resolve') {
            setBulkPhase('resolve')
            setBulkIndex(p.index)
            setBulkTotal(p.total)
            setStatResolved(p.resolved)
          } else {
            setBulkPhase('send')
            setBulkIndex(p.index)
            setBulkTotal(p.total)
            setStatSent(p.sent); setStatAlready(p.already); setStatFailed(p.failed)
          }
        }
      )
      const totalTargets = phoneNumbers.length + userIds.length
      const firstFailed = result.details?.find(d => d.status === 'failed')
      const extra = firstFailed?.code ? ` · Mã lỗi ví dụ: ${firstFailed.code}` : ''
      const summary = `Đã xử lý ${totalTargets} mục · Gửi: ${result.sent} · Đã là bạn: ${result.already} · Thất bại: ${result.failed}${extra}`
      toast.success(summary)
      console.log('[Bulk Add Friends] details:', result.details)

      // Dọn form
      setBulkPhones('')
      setBulkUserIds('')
      setShowBulkAddModal(false)
    } catch (error) {
      console.error('Bulk add friends error:', error)
      toast.error('Lỗi khi thêm bạn bè hàng loạt')
    } finally {
      setLoading(false)
      setBulkRunning(false)
      setBulkPhase('idle')
      setBulkIndex(0)
      setBulkTotal(0)
    }
  }

  const handleAddTag = async (friendId: string, tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    // Chỉ cho phép gán label đã tồn tại trên Zalo
    if (!allTags.includes(trimmed)) {
      toast.error('Label chưa tồn tại trên Zalo. Vui lòng tạo trước trong Zalo.')
      return
    }
    setLoading(true)
    try {
      const ok = await zaloService.addFriendToLabel(friendId, trimmed)
      if (ok) {
        addFriendTag(friendId, trimmed)
        // reload labels to keep version in sync
        const res = await zaloService.getLabels()
        if (res) {
          setLabels(res.labelData.map((l: any) => ({ id: l.id, text: l.text, conversations: l.conversations })))
          setLabelsVersion(res.version)
        }
        toast.success('Đã gán label')
      } else {
        toast.error('Không thể cập nhật label trên Zalo')
      }
    } catch (e) {
      toast.error('Lỗi khi cập nhật label')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (friendId: string, tag: string) => {
    setLoading(true)
    try {
      const ok = await zaloService.removeFriendFromLabel(friendId, tag)
      if (ok) {
        removeFriendTag(friendId, tag)
        const res = await zaloService.getLabels()
        if (res) {
          setLabels(res.labelData.map((l: any) => ({ id: l.id, text: l.text, conversations: l.conversations })))
          setLabelsVersion(res.version)
        }
        toast.success('Đã gỡ label')
      } else {
        toast.error('Không thể cập nhật label trên Zalo')
      }
    } catch (e) {
      toast.error('Lỗi khi cập nhật label')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFriend = (friend: ZaloFriend) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa "${friend.name}"?`)) {
      deleteFriend(friend.id)
      toast.success('Đã xóa bạn bè')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Quản lý bạn bè</h1>
          <p className="text-secondary-600 mt-1">
            Quản lý danh sách bạn bè và thêm bạn mới
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleSyncFriends}
            loading={loading}
            icon={<Download className="w-4 h-4" />}
          >
            Đồng bộ
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowBulkAddModal(true)}
            icon={<Upload className="w-4 h-4" />}
          >
            Thêm hàng loạt
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Thêm bạn
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Tìm kiếm bạn bè..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="w-48">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Tất cả tag</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Filter className="w-4 h-4" />}
            >
              Lọc
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Friends List */}
      {!showList ? (
        <div className="col-span-full">
          <Card>
            <CardContent className="text-center py-12">
              <UserPlus className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">
                Chưa tải danh sách bạn bè
              </h3>
              <p className="text-secondary-600 mb-4">
                Nhấn "Đồng bộ" để tải danh sách bạn từ Zalo. Dữ liệu sẽ không được tải tự động.
              </p>
              <div className="flex justify-center space-x-2">
                <Button variant="outline" onClick={handleSyncFriends} icon={<Download className="w-4 h-4" />}>Đồng bộ</Button>
                <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />}>Thêm bạn</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFriends.map((friend) => (
            <Card key={friend.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-secondary-900 truncate">
                      {friend.displayName || friend.name}
                    </h3>
                    {friend.phone && (
                      <p className="text-sm text-secondary-600">{friend.phone}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFriend(friend)}
                    className="p-1 text-error-600 hover:text-error-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {(friendTagsMap.get(friend.id) || []).map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-error-50"
                      onClick={() => handleRemoveTag(friend.id, tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-6"
                    onClick={() => {
                      const tag = prompt('Nhập tag mới:')
                      if (tag) handleAddTag(friend.id, tag)
                    }}
                  >
                    <Tag className="w-3 h-3" />
                  </Button>
                </div>

                <div className="text-xs text-secondary-500">
                  Thêm: {formatRelativeTime(friend.addedAt)}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredFriends.length === 0 && (
            <div className="col-span-full">
              <Card>
                <CardContent className="text-center py-12">
                  <UserPlus className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-secondary-900 mb-2">
                    {searchQuery || selectedTag ? 'Không tìm thấy bạn bè' : 'Chưa có bạn bè nào'}
                  </h3>
                  <p className="text-secondary-600 mb-4">
                    {searchQuery || selectedTag
                      ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc'
                      : 'Thêm bạn bè đầu tiên hoặc đồng bộ từ Zalo'
                    }
                  </p>
                  {!searchQuery && !selectedTag && (
                    <div className="flex justify-center space-x-2">
                      <Button onClick={() => setShowAddModal(true)}>
                        Thêm bạn
                      </Button>
                      <Button variant="outline" onClick={handleSyncFriends}>
                        Đồng bộ từ Zalo
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Add Single Friend Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Thêm bạn bè"
      >
        <div className="space-y-4">
          <Input
            label="Số điện thoại"
            placeholder="0xxxxxxxxx"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />

          <div>
            <label htmlFor="friendMessage" className="block text-sm font-medium text-secondary-700 mb-2">
              Nội dung lời mời
            </label>
            <textarea
              id="friendMessage"
              value={friendMessage}
              onChange={(e) => setFriendMessage(e.target.value)}
              placeholder="Xin chào, mình muốn kết bạn với bạn!"
              rows={3}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={handleAddSingleFriend}
              loading={loading}
            >
              Thêm bạn
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Add Friends Modal */}
      <Modal
        open={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        title="Thêm bạn hàng loạt"
        size="lg"
      >
        <div className="space-y-4">
          {bulkRunning && (
            <div className="space-y-2 p-3 rounded-lg bg-secondary-50 border border-secondary-200">
              <div className="flex items-center justify-between text-sm text-secondary-700">
                <span>{bulkPhase === 'resolve' ? 'Đang xử lý số điện thoại' : 'Đang gửi lời mời'}</span>
                <span>{bulkIndex}/{Math.max(1, bulkTotal)}</span>
              </div>
              <div className="w-full h-2 bg-secondary-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 transition-all" style={{ width: `${Math.min(100, Math.round((bulkIndex/Math.max(1, bulkTotal))*100))}%` }} />
              </div>
              <div className="text-xs text-secondary-600">
                Gửi: {statSent} · Đã là bạn: {statAlready} · Thất bại: {statFailed} · Đã dò số: {statResolved}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="bulkMessage" className="block text-sm font-medium text-secondary-700 mb-2">
              Nội dung lời mời (áp dụng cho tất cả)
            </label>
            <textarea
              id="bulkMessage"
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="Xin chào, mình muốn kết bạn với bạn!"
              rows={2}
              disabled={bulkRunning}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bulkPhones" className="block text-sm font-medium text-secondary-700 mb-2">
                Danh sách số điện thoại (mỗi số một dòng)
              </label>
              <textarea id="bulkPhones"
                value={bulkPhones}
                onChange={(e) => setBulkPhones(e.target.value)}
                placeholder="0123456789&#10;0987654321&#10;..."
                rows={8}
                disabled={bulkRunning}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="bulkUserIds" className="block text-sm font-medium text-secondary-700 mb-2">
                Danh sách userId (mỗi id một dòng)
              </label>
              <textarea id="bulkUserIds"
                value={bulkUserIds}
                onChange={(e) => setBulkUserIds(e.target.value)}
                placeholder="1234567890123456789&#10;9876543210987654321&#10;..."
                rows={8}
                disabled={bulkRunning}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <Input
                label="Delay giữa mỗi lời mời (s)"
                placeholder="30"
                value={bulkDelaySec}
                onChange={(e) => setBulkDelaySec(e.target.value)}
                disabled={bulkRunning}
              />
              <p className="text-xs text-secondary-500 mt-1">Khoảng 0–600s. Mặc định 30s.</p>
            </div>
            <div className="md:col-span-2 flex items-center justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowBulkAddModal(false)} disabled={bulkRunning}>
                Hủy
              </Button>
              <Button onClick={handleBulkAddFriends} loading={loading || bulkRunning} disabled={bulkRunning}>
                Thêm hàng loạt
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Friends
