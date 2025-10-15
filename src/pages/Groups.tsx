import React from 'react'
import { Plus, Search, Download, Users, LogOut, Eye, UserPlus, Crown, Shield, Copy } from 'lucide-react'
import { Button, Card, CardContent, Badge, Modal, Input, Textarea } from '@/components/ui'
import { useGroupsStore, useAccountStore } from '@/store'
import { formatRelativeTime, cn } from '@/utils'
import { zaloService } from '@/services'
import type { ZaloGroup } from '@/types'
import toast from 'react-hot-toast'

const Groups: React.FC = () => {
  const { groups, setGroups, deleteGroup, updateGroup } = useGroupsStore()

  const { activeAccount } = useAccountStore()
  const [showJoinModal, setShowJoinModal] = React.useState(false)
  const [showAddUserModal, setShowAddUserModal] = React.useState(false)
  const [selectedGroup, setSelectedGroup] = React.useState<ZaloGroup | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [joinLink, setJoinLink] = React.useState('')
  const [addUserInput, setAddUserInput] = React.useState('')
  const [addUserType, setAddUserType] = React.useState<'phone' | 'userid'>('phone')
  const [filterType, setFilterType] = React.useState<'all' | 'admin' | 'member'>('all')

  // Debounce search để giảm render thừa
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Get filtered groups
  const filteredGroups = React.useMemo(() => {
    let result = groups

    // Filter by type
    if (filterType === 'admin') {
      result = result.filter(g => g.isAdmin)
    } else if (filterType === 'member') {
      result = result.filter(g => !g.isAdmin)
    }

    // Filter by search query
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase()
      result = result.filter(g => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q))
    }

    return result
  }, [groups, debouncedQuery, filterType])

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
          isAdmin: info?.isAdmin ?? false, // Sử dụng isAdmin từ service layer
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
          // Sử dụng getGroupInfo từ service layer để có logic isAdmin đúng
          const results = await Promise.all(
            batch.map(async (id) => {
              try {
                const info = await (zaloService as any).getGroupInfo(id)
                return { id, info }
              } catch (error) {
                console.error(`Error getting info for group ${id}:`, error)
                return { id, info: null }
              }
            })
          )

          const failed: string[] = []
          for (const { id, info } of results) {
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
      const adminCount = Object.values(enrichedMap).filter(g => g.isAdmin).length
      const memberCount = okCount - adminCount

      toast.success(
        `Đã đồng bộ ${okCount}/${ids.length} nhóm • ${adminCount} admin • ${memberCount} thành viên`,
        { duration: 4000 }
      )
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
          // Sử dụng getGroupInfo từ service layer để có logic isAdmin đúng
          const results = await Promise.all(
            batch.map(async (id) => {
              try {
                const info = await (zaloService as any).getGroupInfo(id)
                return { id, info }
              } catch (error) {
                console.error(`Error getting info for group ${id}:`, error)
                return { id, info: null }
              }
            })
          )

          if (!cancelled) {
            for (const { id, info } of results) {
              const hasName = info && String(info.name || '').trim().length > 0
              if (hasName) {
                updateGroup(id, {
                  name: info.name,
                  avatar: info.avatar || undefined,
                  description: info.description || undefined,
                  memberCount: info.memberCount ?? undefined,
                  isAdmin: info.isAdmin ?? undefined, // Sử dụng isAdmin từ service layer
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

  const handleCopyGroupInfo = async (group: ZaloGroup) => {
    try {
      const groupInfo = `Tên nhóm: ${group.name}
ID nhóm: ${group.id}
Số thành viên: ${group.memberCount}
Vai trò: ${group.isAdmin ? 'Admin' : 'Thành viên'}
Loại nhóm: ${group.type === 'public' ? 'Công khai' : 'Riêng tư'}${group.description ? `\nMô tả: ${group.description}` : ''}
Tham gia: ${formatRelativeTime(group.joinedAt)}`

      try {
        await navigator.clipboard.writeText(groupInfo)
        toast.success('Đã copy thông tin nhóm', { duration: 2000 })
      } catch {
        // Fallback khi Clipboard API không khả dụng
        const ta = document.createElement('textarea')
        ta.value = groupInfo
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        toast.success('Đã copy thông tin nhóm', { duration: 2000 })
      }
    } catch (error) {
      console.error('Copy group info error:', error)
      toast.error('Không thể copy thông tin nhóm')
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

  const handleAddUsersToGroup = async () => {
    if (!selectedGroup) {
      toast.error('Vui lòng chọn nhóm')
      return
    }

    if (!addUserInput.trim()) {
      toast.error('Vui lòng nhập danh sách người dùng')
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
      // Parse input - support multiple formats
      const inputs = addUserInput
        .split(/[\n,;\s]+/)
        .map(s => s.trim())
        .filter(Boolean)

      if (inputs.length === 0) {
        toast.error('Vui lòng nhập danh sách người dùng hợp lệ')
        setLoading(false)
        return
      }

      // Show progress toast for multiple users
      if (inputs.length > 5) {
        toast.loading(`Đang xử lý ${inputs.length} người dùng... Vui lòng đợi`, {
          id: 'add-users-progress',
          duration: 0 // Keep showing until dismissed
        })
      }

      let result
      if (addUserType === 'phone') {
        // Add by phone numbers with delay for multiple users
        result = await zaloService.addUsersToGroupByPhones(selectedGroup.id, inputs)

        // Dismiss progress toast
        toast.dismiss('add-users-progress')

        if (result.success) {
          const { added, failed } = result
          if (added > 0 && failed > 0) {
            toast.success(`✅ Đã thêm ${added}/${inputs.length} người dùng. ${failed} thất bại.`, { duration: 4000 })
          } else if (added > 0) {
            toast.success(`✅ Đã thêm thành công ${added} người dùng vào nhóm`)
          } else {
            toast.error(`❌ Không thể thêm người dùng nào. ${failed} thất bại.`)
          }

          // Show details if there are failures
          if (failed > 0) {
            const failedDetails = result.details
              .filter(d => d.status === 'failed')
              .map(d => `${d.phone}: ${d.error || 'Lỗi không xác định'}`)
              .slice(0, 3) // Show max 3 errors to avoid too long message

            if (failedDetails.length > 0) {
              console.log('Failed to add users:', failedDetails)
              const moreText = result.details.filter(d => d.status === 'failed').length > 3 ? ` và ${result.details.filter(d => d.status === 'failed').length - 3} lỗi khác` : ''
              toast.error(`Chi tiết lỗi: ${failedDetails.join(', ')}${moreText}`, { duration: 8000 })
            }
          }
        } else {
          toast.error('❌ Không thể thêm người dùng vào nhóm')
        }
      } else {
        // Add by user IDs with delay for multiple users
        const userIds = inputs.filter(id => /^\d+$/.test(id)) // Only numeric IDs
        if (userIds.length === 0) {
          toast.error('Vui lòng nhập User ID hợp lệ (chỉ số)')
          setLoading(false)
          return
        }

        // Show progress toast for multiple user IDs
        if (userIds.length > 5) {
          toast.loading(`Đang thêm ${userIds.length} User ID... Vui lòng đợi`, {
            id: 'add-userids-progress',
            duration: 0
          })
        }

        result = await zaloService.addUserToGroup(selectedGroup.id, userIds)

        // Dismiss progress toast
        toast.dismiss('add-userids-progress')

        if (result.success) {
          const added = userIds.length - (result.errorMembers?.length || 0)
          const failed = result.errorMembers?.length || 0

          if (added > 0 && failed > 0) {
            toast.success(`✅ Đã thêm ${added}/${userIds.length} người dùng. ${failed} thất bại.`, { duration: 4000 })
          } else if (added > 0) {
            toast.success(`✅ Đã thêm thành công ${added} người dùng vào nhóm`)
          } else {
            toast.error(`❌ Không thể thêm người dùng nào. ${failed} thất bại.`)
          }

          if (result.errorMembers && result.errorMembers.length > 0) {
            console.log('Failed user IDs:', result.errorMembers)
            const failedIds = result.errorMembers.slice(0, 3).join(', ')
            const moreText = result.errorMembers.length > 3 ? ` và ${result.errorMembers.length - 3} ID khác` : ''
            toast.error(`User ID thất bại: ${failedIds}${moreText}`, { duration: 6000 })
          }

          // Check for "not friends" error
          if ((result as any).notFriendUsers && (result as any).notFriendUsers.length > 0) {
            const notFriendUsers = (result as any).notFriendUsers as string[]
            toast.error(`⚠️ ${notFriendUsers.length} người dùng cần kết bạn trước khi thêm vào nhóm`, { duration: 8000 })
            console.log('Not friend users:', notFriendUsers)
          }
        } else {
          // Check if error is due to "not friends"
          if (result.error?.includes('kết bạn')) {
            toast.error('⚠️ ' + result.error, { duration: 8000 })
            toast('💡 Gợi ý: Gửi lời mời kết bạn trước, sau đó thử lại', { duration: 10000, icon: '💡' })
          } else {
            toast.error(result.error || '❌ Không thể thêm người dùng vào nhóm')
          }
        }
      }

      // Clear form and close modal on success
      if (result?.success) {
        setAddUserInput('')
        setShowAddUserModal(false)
        setSelectedGroup(null)

        // Refresh group member count
        setTimeout(() => {
          handleViewMembers(selectedGroup)
        }, 1000)
      }
    } catch (error) {
      console.error('Add users to group error:', error)
      toast.error('❌ Lỗi khi thêm người dùng vào nhóm')
    } finally {
      // Ensure progress toasts are dismissed
      toast.dismiss('add-users-progress')
      toast.dismiss('add-userids-progress')
      setLoading(false)
    }
  }

  const handleShowAddUserModal = (group: ZaloGroup) => {
    setSelectedGroup(group)
    setAddUserInput('')
    setAddUserType('phone')
    setShowAddUserModal(true)
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

        <Card className="bg-gradient-to-br from-success-50 to-success-100 dark:from-success-900/20 dark:to-success-800/20 border-success-200 dark:border-success-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success-200 dark:bg-success-800 rounded-lg">
                <Crown className="w-5 h-5 text-success-700 dark:text-success-300" />
              </div>
              <div>
                <p className="text-sm text-success-700 dark:text-success-300 font-medium">Nhóm admin</p>
                <p className="text-xl font-bold text-success-900 dark:text-success-100">
                  {groups.filter(g => g.isAdmin).length}
                </p>
                <p className="text-xs text-success-600 dark:text-success-400">
                  {Math.round((groups.filter(g => g.isAdmin).length / Math.max(groups.length, 1)) * 100)}% tổng nhóm
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

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Input
            placeholder="Tìm kiếm nhóm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />

          {/* Filter Tabs */}
          <div className="flex space-x-1 bg-secondary-100 dark:bg-secondary-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center space-x-2',
                filterType === 'all'
                  ? 'bg-white dark:bg-secondary-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200'
              )}
            >
              <Users className="w-4 h-4" />
              <span>Tất cả ({groups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('admin')}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center space-x-2',
                filterType === 'admin'
                  ? 'bg-white dark:bg-secondary-700 text-success-600 dark:text-success-400 shadow-sm'
                  : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200'
              )}
            >
              <Crown className="w-4 h-4" />
              <span>Nhóm admin ({groups.filter(g => g.isAdmin).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('member')}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center space-x-2',
                filterType === 'member'
                  ? 'bg-white dark:bg-secondary-700 text-info-600 dark:text-info-400 shadow-sm'
                  : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200'
              )}
            >
              <Shield className="w-4 h-4" />
              <span>Thành viên ({groups.filter(g => !g.isAdmin).length})</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGroups.map((group) => (
          <Card
            key={group.id}
            className={cn(
              "transition-all duration-200 hover:shadow-lg",
              group.isAdmin && "ring-2 ring-success-200 dark:ring-success-800 bg-gradient-to-br from-white to-success-50 dark:from-secondary-900 dark:to-success-900/10"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3 mb-3">
                <div className="relative">
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
                  {group.isAdmin && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-success-500 rounded-full flex items-center justify-center">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-medium text-secondary-900 truncate">
                      {group.name}
                    </h3>
                    {group.isAdmin && (
                      <Badge
                        variant="success"
                        className="text-xs bg-gradient-to-r from-success-100 to-success-200 text-success-800 border-success-300 px-2 py-0.5"
                      >
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-secondary-600">
                    {group.memberCount} thành viên
                  </p>
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

              <div className="space-y-2">
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
                  {group.isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowAddUserModal(group)}
                      className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-primary-200 hover:border-primary-300 transition-all duration-200"
                      title="Thêm thành viên"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  )}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyGroupInfo(group)}
                  className="w-full text-info-600 hover:text-info-700 hover:bg-info-50 dark:hover:bg-info-900/20 border-info-200 hover:border-info-300 transition-all duration-200"
                  icon={<Copy className="w-4 h-4" />}
                >
                  Copy thông tin nhóm
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredGroups.length === 0 && (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center py-12">
                {filterType === 'admin' ? (
                  <Crown className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                ) : filterType === 'member' ? (
                  <Shield className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                ) : (
                  <Users className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                )}
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  {searchQuery
                    ? 'Không tìm thấy nhóm'
                    : filterType === 'admin'
                      ? 'Chưa có nhóm admin nào'
                      : filterType === 'member'
                        ? 'Chưa có nhóm thành viên nào'
                        : 'Chưa tham gia nhóm nào'
                  }
                </h3>
                <p className="text-secondary-600 mb-4">
                  {searchQuery
                    ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc'
                    : filterType === 'admin'
                      ? 'Tạo nhóm mới hoặc được thêm làm admin để hiển thị ở đây'
                      : filterType === 'member'
                        ? 'Tham gia nhóm với tư cách thành viên để hiển thị ở đây'
                        : 'Tham gia nhóm đầu tiên hoặc đồng bộ từ Zalo'
                  }
                </p>
                {!searchQuery && filterType === 'all' && (
                  <div className="flex justify-center space-x-2">
                    <Button onClick={() => setShowJoinModal(true)}>
                      Tham gia nhóm
                    </Button>
                    <Button variant="outline" onClick={handleSyncGroups}>
                      Đồng bộ từ Zalo
                    </Button>
                  </div>
                )}
                {filterType !== 'all' && (
                  <Button
                    variant="outline"
                    onClick={() => setFilterType('all')}
                    className="mt-2"
                  >
                    Xem tất cả nhóm
                  </Button>
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

      {/* Add Users to Group Modal */}
      <Modal
        open={showAddUserModal}
        onClose={() => {
          setShowAddUserModal(false)
          setSelectedGroup(null)
          setAddUserInput('')
        }}
        title="Thêm thành viên vào nhóm"
        description={selectedGroup ? `Thêm thành viên mới vào nhóm "${selectedGroup.name}"` : undefined}
        size="lg"
      >
        <div className="space-y-6">
          {/* Input Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
              Loại dữ liệu đầu vào
            </label>
            <div className="flex space-x-1 bg-secondary-100 dark:bg-secondary-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setAddUserType('phone')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  addUserType === 'phone'
                    ? 'bg-white dark:bg-secondary-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200'
                )}
              >
                Số điện thoại
              </button>
              <button
                type="button"
                onClick={() => setAddUserType('userid')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  addUserType === 'userid'
                    ? 'bg-white dark:bg-secondary-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200'
                )}
              >
                User ID
              </button>
            </div>
          </div>

          {/* Input Field */}
          <Textarea
            label={addUserType === 'phone' ? 'Danh sách số điện thoại' : 'Danh sách User ID'}
            value={addUserInput}
            onChange={(e) => setAddUserInput(e.target.value)}
            placeholder={
              addUserType === 'phone'
                ? 'Nhập số điện thoại, mỗi số một dòng hoặc cách nhau bằng dấu phẩy:\n0901234567\n0987654321\n...'
                : 'Nhập User ID, mỗi ID một dòng hoặc cách nhau bằng dấu phẩy:\n1234567890\n9876543210\n...'
            }
            rows={8}
            required
          />

          {/* Help Text */}
          <div className="text-sm text-secondary-600 dark:text-secondary-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl">
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Hướng dẫn sử dụng</p>
                {addUserType === 'phone' ? (
                  <ul className="space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Nhập số điện thoại Việt Nam (bắt đầu bằng 0 hoặc +84)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Mỗi số điện thoại một dòng hoặc cách nhau bằng dấu phẩy, chấm phẩy</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Hệ thống sẽ tự động tìm User ID từ số điện thoại</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Chỉ thêm được những người đã là bạn bè trên Zalo</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-orange-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span className="text-orange-700 dark:text-orange-300">
                        <strong>Lưu ý:</strong> Khi thêm nhiều người (&gt;5), hệ thống sẽ xử lý từng batch với delay để tránh spam
                      </span>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Nhập User ID (chỉ số, không có ký tự đặc biệt)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Mỗi User ID một dòng hoặc cách nhau bằng dấu phẩy, chấm phẩy</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Có thể lấy User ID từ tính năng "Xem thành viên" của nhóm khác</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>User ID thường là dãy số dài 10-15 chữ số</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-orange-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span className="text-orange-700 dark:text-orange-300">
                        <strong>Lưu ý:</strong> Khi thêm nhiều User ID (&gt;5), hệ thống sẽ xử lý từng batch với delay để tránh spam
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-secondary-200 dark:border-secondary-700">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddUserModal(false)
                setSelectedGroup(null)
                setAddUserInput('')
              }}
              disabled={loading}
              className="px-6 py-2.5"
            >
              Hủy
            </Button>
            <Button
              onClick={handleAddUsersToGroup}
              loading={loading}
              icon={<UserPlus className="w-4 h-4" />}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Thêm thành viên
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Groups
