import React from 'react'
import { Plus, Search, Download, Users, LogOut, Eye } from 'lucide-react'
import { Button, Card, CardContent, Badge, Modal, Input } from '@/components/ui'
import { useGroupsStore, useAccountStore } from '@/store'
import { formatRelativeTime } from '@/utils'
import { zaloService } from '@/services'
import type { ZaloGroup } from '@/types'
import toast from 'react-hot-toast'

const Groups: React.FC = () => {
  const { groups, setGroups, deleteGroup, updateGroup } = useGroupsStore()

  const { activeAccount } = useAccountStore()
  const [showJoinModal, setShowJoinModal] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [joinLink, setJoinLink] = React.useState('')

  // Debounce search để giảm render thừa
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Get filtered groups
  const filteredGroups = React.useMemo(() => {
    if (!debouncedQuery) return groups
    const q = debouncedQuery.toLowerCase()
    return groups.filter(g => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q))
  }, [groups, debouncedQuery])

  const handleSyncGroups = async () => {
    console.log('🔥 handleSyncGroups called!')

    if (!activeAccount) {
      console.log('🔥 No active account')
      toast.error('Vui lòng chọn tài khoản trước')
      return
    }

    if (!zaloService.isLoggedIn()) {
      console.log('🔥 Zalo service not logged in')
      toast.error('Vui lòng đăng nhập tài khoản trước')
      return
    }

    console.log('🔥 Starting sync groups...')
    setLoading(true)
    // Xoá danh sách hiện tại để tránh còn sót placeholder từ lần trước
    setGroups([])
    try {
      // Bước 1: chỉ lấy danh sách ID nhóm (placeholder)
      const baseGroups = await zaloService.getAllGroups()
      const ids = Array.from(new Set((baseGroups || []).map(g => g.id).filter(Boolean)))
      console.log('🔥 Groups IDs received:', ids.length)

      // Tiện ích
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
      const toGroup = (id: string, info: any): ZaloGroup => {
        const ph = baseGroups.find(g => g.id === id)
        const name = String(info?.name || '').trim()
        return {
          id,
          name,
          description: info?.description ?? '',
          memberCount: Number.isFinite(info?.memberCount) ? info.memberCount : 0,
          isAdmin: ph?.isAdmin ?? false,
          avatar: info?.avatar ?? '',
          joinedAt: ph?.joinedAt || new Date(),
          type: ph?.type || 'private',
        }
      }
      const isValid = (info: any) => !!(info && String(info.name || '').trim().length > 0)

      // Enrich theo lô 20 nhóm/lần; retry tối đa 2 vòng; fallback gọi đơn từng id
      const batchSize = 20
      const enrichedMap: Record<string, ZaloGroup> = {}

      const runBatch = async (batch: string[], delayMs: number) => {
        try {
          const infoMap = await (zaloService as any).getGroupInfos(batch)
          const failed: string[] = []
          for (const id of batch) {
            const info = infoMap?.[id]
            if (isValid(info)) {
              enrichedMap[id] = toGroup(id, info)
            } else {
              failed.push(id)
            }
          }
          setGroups(Object.values(enrichedMap))
          await sleep(delayMs)
          return failed
        } catch (e) {
          console.warn('batch enrich error:', e)
          await sleep(delayMs)
          return batch
        }
      }

      // Vòng 0: quét toàn bộ
      let pending = ids.slice(0)
      for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize)
        const failed = await runBatch(batch, 250)
        // Fallback đơn lẻ cho những id fail của batch này
        const still: string[] = []
        for (const id of failed) {
          try {
            const info = await (zaloService as any).getGroupInfo(id)
            if (isValid(info)) {
              enrichedMap[id] = toGroup(id, info)
              setGroups(Object.values(enrichedMap))
            } else {
              still.push(id)
            }
          } catch {
            still.push(id)
          }
          await sleep(150)
        }
        pending = pending.filter(x => !failed.includes(x)).concat(still)
      }

      // Retry thêm 2 vòng cho những id còn lại
      for (let pass = 1; pass <= 2 && pending.length > 0; pass++) {
        const next: string[] = []
        for (let i = 0; i < pending.length; i += batchSize) {
          const batch = pending.slice(i, i + batchSize)
          const failed = await runBatch(batch, 350 + pass * 150)
          next.push(...failed)
        }
        pending = next
      }

      const okCount = Object.keys(enrichedMap).length
      toast.success(`Đã đồng bộ ${okCount}/${ids.length} nhóm (đã có thông tin)`)
    } catch (error) {
      console.error('🔥 Sync groups error:', error)
      toast.error('Lỗi đồng bộ danh sách nhóm')
    } finally {
      setLoading(false)
    }
  }


  // Bổ sung thông tin nhóm (tên/ảnh/mô tả) bằng getGroupInfo theo lô, chạy nền, tránh chặn UI
  const enrichedSetRef = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (!groups || groups.length === 0) return
    // Lọc các nhóm thiếu dữ liệu quan trọng
    const needIds = groups
      .filter(g => !g.name || g.name === `Nhóm ${g.id}` || !g.avatar)
      .map(g => g.id)
      .filter(id => !enrichedSetRef.current.has(id))

    if (needIds.length === 0) return

    let cancelled = false
    const run = async () => {
      const batchSize = 20
      for (let i = 0; i < needIds.length && !cancelled; i += batchSize) {
        const batch = needIds.slice(i, i + batchSize)
        try {
          // Gọi theo lô 1 lần để giảm round-trip và tránh bị rate-limit
          const infoMap = await (zaloService as any).getGroupInfos(batch)
          if (!cancelled && infoMap) {
            for (const id of batch) {
              const info = infoMap[id]
              const hasName = info && String(info.name || '').trim().length > 0
              if (hasName) {
                updateGroup(id, {
                  name: info.name,
                  avatar: info.avatar || undefined,
                  description: info.description || undefined,
                  memberCount: info.memberCount ?? undefined,
                })
                // Chỉ đánh dấu đã enrich khi có dữ liệu thành công
                enrichedSetRef.current.add(id)
              }
            }
          }
        } catch (e) {
          // lỗi mạng / rate-limit: bỏ qua để lần sau thử lại
        }
        // Nới nhịp giữa các batch để tránh rate-limit
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // Trì hoãn nhẹ để tránh cạnh tranh render đầu trang
    const t = setTimeout(() => run(), 50)
    return () => { cancelled = true; clearTimeout(t) }
  }, [groups, updateGroup])

  const handleJoinGroup = async () => {
    if (!joinLink.trim()) {
      toast.error('Vui lòng nhập link tham gia nhóm')
      return
    }

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
      // Hỗ trợ nhiều link: tách theo xuống dòng, dấu phẩy, chấm phẩy và khoảng trắng
      // Hỗ trợ cấu hình delay qua token "delay=ms" trong nội dung (ví dụ: delay=1200)
      const tokens = Array.from(new Set(
        joinLink
          .split(/[\n,;\s]+/)
          .map(s => s.trim())
          .filter(Boolean)
      ))

      let delayMs = 30000 // mặc định 30s giữa các lần join để tránh rate limit
      const links: string[] = []
      for (const t of tokens) {
        const m = t.match(/^delay=(\d{1,6})(s)?$/i)
        if (m) {
          const v = parseInt(m[1], 10)
          // Nếu có hậu tố 's' hoặc không có, coi như giây -> đổi sang ms
          const sec = isNaN(v) ? 30 : v
          delayMs = Math.max(0, Math.min(600000, sec * 1000))
        } else {
          links.push(t)
        }
      }

      if (links.length === 0) {
        toast.error('Vui lòng nhập link tham gia nhóm')
        setLoading(false)
        return
      }

      if (links.length === 1) {
        const ok = await zaloService.joinGroup(links[0])
        if (ok) {
          toast.success('Đã gửi yêu cầu tham gia nhóm')
        } else {
          toast.error('Không thể tham gia nhóm. Vui lòng kiểm tra link.')
        }
      } else {
        const result = await zaloService.joinGroups(links, delayMs)
        const { joined, already, pending, failed } = result
        const summary = [
          joined.length ? `Thành công: ${joined.length}` : '',
          already.length ? `Đã là thành viên: ${already.length}` : '',
          pending.length ? `Chờ duyệt: ${pending.length}` : '',
          failed.length ? `Lỗi: ${failed.length}` : '',
        ].filter(Boolean).join(' · ')
        toast.success(`Đã xử lý ${links.length} link (delay ${delayMs}ms). ${summary}`)
        if (failed.length > 0) {
          console.warn('Join group failed items:', failed)
        }
      }

      // Dọn dẹp và làm mới danh sách nhóm
      setJoinLink('')
      setShowJoinModal(false)
      setTimeout(() => { handleSyncGroups() }, 1000)
    } catch (error) {
      console.error('Join group error:', error)
      toast.error('Lỗi khi tham gia nhóm')
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveGroup = async (group: ZaloGroup) => {
    if (!window.confirm(`Bạn có chắc chắn muốn rời khỏi nhóm "${group.name}"?`)) {
      return
    }

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
      const success = await zaloService.leaveGroup(group.id)

      if (success) {
        deleteGroup(group.id)
        toast.success('Đã rời khỏi nhóm')
      } else {
        toast.error('Không thể rời khỏi nhóm')
      }
    } catch (error) {
      console.error('Leave group error:', error)
      toast.error('Lỗi khi rời nhóm')
    } finally {
      setLoading(false)
    }
  }

  const handleViewMembers = async (group: ZaloGroup) => {
    if (!activeAccount) {
      toast.error('Vui lòng chọn tài khoản trước')
      return
    }

    if (!zaloService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập tài khoản trước')
      return
    }

    try {
      const members = await zaloService.getGroupMembers(group.id)

      if (members && members.length > 0) {
        // Update group with member count
        updateGroup(group.id, { memberCount: members.length })

        // Copy userIDs của thành viên
        const ids = Array.from(new Set(members.map((m: any) => m.id).filter(Boolean)))
        if (ids.length > 0) {
          const text = ids.join('\n')
          try {
            await navigator.clipboard.writeText(text)
            toast.success(`Đã copy ${ids.length} userID`, { duration: 3000 })
          } catch {
            // Fallback khi Clipboard API không khả dụng
            try {
              const ta = document.createElement('textarea')
              ta.value = text
              ta.style.position = 'fixed'
              ta.style.opacity = '0'
              document.body.appendChild(ta)
              ta.focus(); ta.select()
              document.execCommand('copy')
              document.body.removeChild(ta)
              toast.success(`Đã copy ${ids.length} userID`, { duration: 3000 })
            } catch {
              toast.error('Không thể copy userID')
            }
          }
        } else {
          toast('Không có userID khả dụng', { icon: 'ℹ️', duration: 2500 })
        }

        // Show members info
        const memberNames = members.slice(0, 10).map((m: any) => m.name || m.displayName).join(', ')
        const moreCount = members.length > 10 ? ` và ${members.length - 10} thành viên khác` : ''

        toast.success(`Thành viên: ${memberNames}${moreCount}`, { duration: 5000 })
      } else {
        toast.error('Không thể lấy danh sách thành viên')
      }
    } catch (error) {
      console.error('Get group members error:', error)
      toast.error('Lỗi khi lấy danh sách thành viên')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Quản lý nhóm</h1>
          <p className="text-secondary-600 mt-1">
            Quản lý các nhóm Zalo đã tham gia
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleSyncGroups}
            loading={loading}
            icon={<Download className="w-4 h-4" />}
          >
            Đồng bộ
          </Button>
          <Button
            onClick={() => setShowJoinModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Tham gia nhóm
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Tổng nhóm</p>
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
                <Users className="w-5 h-5 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Nhóm admin</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {groups.filter(g => g.isAdmin).length}
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
                  {groups.reduce((sum, g) => sum + g.memberCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Tìm kiếm nhóm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </CardContent>
      </Card>

      {/* Groups List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGroups.map((group) => (
          <Card key={group.id}>
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
                  {group.isAdmin && (
                    <Badge variant="success" className="text-xs mt-1">
                      Admin
                    </Badge>
                  )}
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-secondary-600 mb-3 line-clamp-2">
                  {group.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-secondary-500 mb-3">
                <span>Tham gia: {formatRelativeTime(group.joinedAt)}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewMembers(group)}
                  className="flex-1"
                  icon={<Eye className="w-4 h-4" />}
                >
                  Xem thành viên
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLeaveGroup(group)}
                  className="p-2 text-error-600 hover:text-error-700 hover:bg-error-50"
                  title="Rời nhóm"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredGroups.length === 0 && (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center py-12">
                <Users className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  {searchQuery ? 'Không tìm thấy nhóm' : 'Chưa tham gia nhóm nào'}
                </h3>
                <p className="text-secondary-600 mb-4">
                  {searchQuery
                    ? 'Thử thay đổi từ khóa tìm kiếm'
                    : 'Tham gia nhóm đầu tiên hoặc đồng bộ từ Zalo'
                  }
                </p>
                {!searchQuery && (
                  <div className="flex justify-center space-x-2">
                    <Button onClick={() => setShowJoinModal(true)}>
                      Tham gia nhóm
                    </Button>
                    <Button variant="outline" onClick={handleSyncGroups}>
                      Đồng bộ từ Zalo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Join Group Modal */}
      <Modal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Tham gia nhóm"
      >
        <div className="space-y-4">
          <Input
            label="Link tham gia nhóm"
            placeholder="https://zalo.me/g/..."
            value={joinLink}
            onChange={(e) => setJoinLink(e.target.value)}
            required
          />

          <div className="text-sm text-secondary-600">
            <p className="mb-2">Hướng dẫn lấy link tham gia nhóm:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Mở nhóm Zalo trên điện thoại</li>
              <li>Chọn "Thông tin nhóm" → "Mời bạn bè"</li>
              <li>Chọn "Sao chép link" và dán vào đây</li>
            </ol>
            <p className="mt-2 text-xs">Có thể dán nhiều link và phân tách bằng dấu phẩy, chấm phẩy, khoảng trắng hoặc xuống dòng.</p>
            <p className="text-xs">Tùy chọn: thêm "delay=30s" để giãn cách 30 giây giữa mỗi lần tham gia nhóm (0–600s).</p>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowJoinModal(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={handleJoinGroup}
              loading={loading}
            >
              Tham gia
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Groups
