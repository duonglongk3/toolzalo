import React from 'react'
import { Share2, Plus, Tag, TrendingUp, BarChart3, Calendar, Filter, Search } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Modal, Input } from '@/components/ui'
import { useGroupsStore, useFriendsStore, useAccountStore } from '@/store'
import { formatRelativeTime } from '@/utils'
import { zaloService } from '@/services'
import type { ZaloGroup, ZaloFriend } from '@/types'
import toast from 'react-hot-toast'

interface ShareCategory {
  id: string
  name: string
  color: string
  description: string
  createdAt: Date
}

interface ShareContent {
  id: string
  title: string
  content: string
  categoryId: string
  tags: string[]
  targetType: 'friends' | 'groups' | 'both'
  targetIds: string[]
  scheduledAt?: Date
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  sentCount: number
  totalCount: number
  createdAt: Date
  sentAt?: Date
  analytics: {
    views: number
    clicks: number
    shares: number
    reactions: number
  }
}

const ShareContent: React.FC = () => {
  const { groups } = useGroupsStore()
  const { friends } = useFriendsStore()
  const { activeAccount } = useAccountStore()
  const [categories, setCategories] = React.useState<ShareCategory[]>([
    {
      id: '1',
      name: 'Khuyến mãi',
      color: '#EF4444',
      description: 'Nội dung về khuyến mãi, giảm giá',
      createdAt: new Date()
    },
    {
      id: '2',
      name: 'Thông báo',
      color: '#3B82F6',
      description: 'Thông báo chung, cập nhật',
      createdAt: new Date()
    },
    {
      id: '3',
      name: 'Sản phẩm',
      color: '#10B981',
      description: 'Giới thiệu sản phẩm mới',
      createdAt: new Date()
    }
  ])
  const [contents, setContents] = React.useState<ShareContent[]>([])
  const [showCategoryModal, setShowCategoryModal] = React.useState(false)
  const [showContentModal, setShowContentModal] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState<string>('')
  const [searchQuery, setSearchQuery] = React.useState('')

  // Category form
  const [categoryForm, setCategoryForm] = React.useState({
    name: '',
    color: '#3B82F6',
    description: ''
  })

  // Content form
  const [contentForm, setContentForm] = React.useState({
    title: '',
    content: '',
    categoryId: '',
    tags: '',
    targetType: 'both' as 'friends' | 'groups' | 'both',
    targetIds: [] as string[],
    isScheduled: false,
    scheduledDate: '',
    scheduledTime: ''
  })

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', color: '#3B82F6', description: '' })
  }

  const resetContentForm = () => {
    setContentForm({
      title: '',
      content: '',
      categoryId: '',
      tags: '',
      targetType: 'both',
      targetIds: [],
      isScheduled: false,
      scheduledDate: '',
      scheduledTime: ''
    })
  }

  const handleCreateCategory = () => {
    if (!categoryForm.name.trim()) {
      toast.error('Vui lòng nhập tên danh mục')
      return
    }

    const newCategory: ShareCategory = {
      id: crypto.randomUUID(),
      name: categoryForm.name.trim(),
      color: categoryForm.color,
      description: categoryForm.description.trim(),
      createdAt: new Date()
    }

    setCategories(prev => [...prev, newCategory])
    toast.success('Đã tạo danh mục')
    resetCategoryForm()
    setShowCategoryModal(false)
  }

  const handleCreateContent = () => {
    if (!contentForm.title.trim() || !contentForm.content.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin')
      return
    }

    if (!contentForm.categoryId) {
      toast.error('Vui lòng chọn danh mục')
      return
    }

    if (contentForm.targetIds.length === 0) {
      toast.error('Vui lòng chọn đối tượng chia sẻ')
      return
    }

    let scheduledAt: Date | undefined
    if (contentForm.isScheduled) {
      if (!contentForm.scheduledDate || !contentForm.scheduledTime) {
        toast.error('Vui lòng chọn thời gian lên lịch')
        return
      }
      scheduledAt = new Date(`${contentForm.scheduledDate}T${contentForm.scheduledTime}`)
      if (scheduledAt <= new Date()) {
        toast.error('Thời gian lên lịch phải trong tương lai')
        return
      }
    }

    const newContent: ShareContent = {
      id: crypto.randomUUID(),
      title: contentForm.title.trim(),
      content: contentForm.content.trim(),
      categoryId: contentForm.categoryId,
      tags: contentForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      targetType: contentForm.targetType,
      targetIds: [...contentForm.targetIds],
      scheduledAt,
      status: contentForm.isScheduled ? 'scheduled' : 'draft',
      sentCount: 0,
      totalCount: contentForm.targetIds.length,
      createdAt: new Date(),
      analytics: {
        views: 0,
        clicks: 0,
        shares: 0,
        reactions: 0
      }
    }

    setContents(prev => [newContent, ...prev])
    toast.success(contentForm.isScheduled ? 'Đã lên lịch chia sẻ' : 'Đã tạo nội dung')
    resetContentForm()
    setShowContentModal(false)
  }

  const handleShareContent = async (content: ShareContent) => {
    if (!activeAccount) {
      toast.error('Vui lòng chọn tài khoản trước')
      return
    }

    if (!zaloService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập tài khoản trước')
      return
    }

    // Update status to sending
    setContents(prev => prev.map(c => 
      c.id === content.id ? { ...c, status: 'sent' as const } : c
    ))

    let sentCount = 0
    const shareMessage = `${content.title}\n\n${content.content}`

    try {
      for (const targetId of content.targetIds) {
        if (content.targetType === 'friends' || content.targetType === 'both') {
          const friend = friends.find(f => f.id === targetId)
          if (friend?.phone) {
            const success = await zaloService.sendMessage(friend.phone, shareMessage)
            if (success) sentCount++
          }
        }

        if (content.targetType === 'groups' || content.targetType === 'both') {
          const group = groups.find(g => g.id === targetId)
          if (group) {
            const success = await zaloService.sendGroupMessage(group.id, shareMessage)
            if (success) sentCount++
          }
        }

        // Add delay between shares
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      // Update content with results
      setContents(prev => prev.map(c => 
        c.id === content.id ? { 
          ...c, 
          status: sentCount > 0 ? 'sent' as const : 'failed' as const,
          sentCount,
          sentAt: new Date(),
          analytics: {
            ...c.analytics,
            views: c.analytics.views + sentCount
          }
        } : c
      ))

      toast.success(`Đã chia sẻ thành công ${sentCount}/${content.totalCount} đối tượng`)
    } catch (error) {
      console.error('Share content error:', error)
      setContents(prev => prev.map(c => 
        c.id === content.id ? { ...c, status: 'failed' as const } : c
      ))
      toast.error('Lỗi khi chia sẻ nội dung')
    }
  }

  const filteredContents = React.useMemo(() => {
    let filtered = contents

    if (selectedCategory) {
      filtered = filtered.filter(content => content.categoryId === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(content => 
        content.title.toLowerCase().includes(query) ||
        content.content.toLowerCase().includes(query) ||
        content.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [contents, selectedCategory, searchQuery])

  const getTargetNames = (content: ShareContent) => {
    const names: string[] = []
    
    content.targetIds.forEach(id => {
      if (content.targetType === 'friends' || content.targetType === 'both') {
        const friend = friends.find(f => f.id === id)
        if (friend) names.push(friend.displayName || friend.name)
      }
      
      if (content.targetType === 'groups' || content.targetType === 'both') {
        const group = groups.find(g => g.id === id)
        if (group) names.push(group.name)
      }
    })
    
    return names
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Share & Phân loại thẻ</h1>
          <p className="text-secondary-600 mt-1">
            Chia sẻ nội dung có tổ chức với hệ thống phân loại và analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowCategoryModal(true)}
            icon={<Tag className="w-4 h-4" />}
          >
            Tạo danh mục
          </Button>
          <Button
            onClick={() => setShowContentModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Tạo nội dung
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Tag className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Danh mục</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {categories.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <Share2 className="w-5 h-5 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Nội dung</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {contents.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-info-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Đã chia sẻ</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {contents.filter(c => c.status === 'sent').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-warning-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Tổng lượt xem</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {contents.reduce((sum, c) => sum + c.analytics.views, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Danh mục</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('')}
            >
              Tất cả ({contents.length})
            </Button>
            {categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  backgroundColor: selectedCategory === category.id ? category.color : undefined,
                  borderColor: category.color,
                  color: selectedCategory === category.id ? 'white' : category.color
                }}
              >
                {category.name} ({contents.filter(c => c.categoryId === category.id).length})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Tìm kiếm nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContents.map((content) => {
          const category = categories.find(c => c.id === content.categoryId)
          const targetNames = getTargetNames(content)
          const statusColor = {
            draft: 'secondary',
            scheduled: 'warning',
            sent: 'success',
            failed: 'error'
          }[content.status] as any

          return (
            <Card key={content.id} className="border border-secondary-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-secondary-900 truncate mb-1">
                      {content.title}
                    </h3>
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge
                        variant="outline"
                        style={{ borderColor: category?.color, color: category?.color }}
                      >
                        {category?.name}
                      </Badge>
                      <Badge variant={statusColor}>
                        {content.status === 'draft' && 'Nháp'}
                        {content.status === 'scheduled' && 'Đã lên lịch'}
                        {content.status === 'sent' && 'Đã gửi'}
                        {content.status === 'failed' && 'Thất bại'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-secondary-600 mb-3 line-clamp-3">
                  {content.content}
                </p>

                {content.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {content.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="text-xs text-secondary-500 mb-3">
                  <p>Đối tượng: {targetNames.slice(0, 2).join(', ')}
                    {targetNames.length > 2 && ` +${targetNames.length - 2}`}
                  </p>
                  <p>Tạo: {formatRelativeTime(content.createdAt)}</p>
                  {content.scheduledAt && (
                    <p>Lên lịch: {content.scheduledAt.toLocaleString('vi-VN')}</p>
                  )}
                </div>

                {content.status === 'sent' && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-secondary-600 mb-3">
                    <div>Lượt xem: {content.analytics.views}</div>
                    <div>Phản hồi: {content.analytics.reactions}</div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  {content.status === 'draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareContent(content)}
                      className="flex-1"
                      icon={<Share2 className="w-4 h-4" />}
                    >
                      Chia sẻ ngay
                    </Button>
                  )}
                  
                  {content.status === 'scheduled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareContent(content)}
                      className="flex-1"
                      icon={<Share2 className="w-4 h-4" />}
                    >
                      Thực hiện ngay
                    </Button>
                  )}

                  {content.status === 'sent' && (
                    <div className="flex-1 text-center text-sm text-success-600">
                      Đã gửi {content.sentCount}/{content.totalCount}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredContents.length === 0 && (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center py-12">
                <Share2 className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  {searchQuery || selectedCategory ? 'Không tìm thấy nội dung' : 'Chưa có nội dung nào'}
                </h3>
                <p className="text-secondary-600 mb-4">
                  {searchQuery || selectedCategory 
                    ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
                    : 'Tạo nội dung đầu tiên để bắt đầu chia sẻ'
                  }
                </p>
                {!searchQuery && !selectedCategory && (
                  <Button onClick={() => setShowContentModal(true)}>
                    Tạo nội dung
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Category Modal */}
      <Modal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Tạo danh mục mới"
      >
        <div className="space-y-4">
          <Input
            label="Tên danh mục"
            placeholder="Ví dụ: Khuyến mãi"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Màu sắc
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                className="w-12 h-10 border border-secondary-300 rounded cursor-pointer"
              />
              <Input
                value={categoryForm.color}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                placeholder="#3B82F6"
                className="flex-1"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Mô tả
            </label>
            <textarea
              value={categoryForm.description}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Mô tả ngắn về danh mục này..."
              rows={3}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowCategoryModal(false)}
            >
              Hủy
            </Button>
            <Button onClick={handleCreateCategory}>
              Tạo danh mục
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Content Modal */}
      <Modal
        open={showContentModal}
        onClose={() => setShowContentModal(false)}
        title="Tạo nội dung chia sẻ"
        size="xl"
      >
        <div className="space-y-4">
          <Input
            label="Tiêu đề"
            placeholder="Tiêu đề nội dung..."
            value={contentForm.title}
            onChange={(e) => setContentForm(prev => ({ ...prev, title: e.target.value }))}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Nội dung
            </label>
            <textarea
              value={contentForm.content}
              onChange={(e) => setContentForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Nội dung chi tiết..."
              rows={6}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Danh mục
              </label>
              <select
                value={contentForm.categoryId}
                onChange={(e) => setContentForm(prev => ({ ...prev, categoryId: e.target.value }))}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Chọn danh mục...</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Tags (phân cách bằng dấu phẩy)"
              placeholder="tag1, tag2, tag3"
              value={contentForm.tags}
              onChange={(e) => setContentForm(prev => ({ ...prev, tags: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Đối tượng chia sẻ
            </label>
            <div className="space-y-2">
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="targetType"
                    value="friends"
                    checked={contentForm.targetType === 'friends'}
                    onChange={(e) => setContentForm(prev => ({ ...prev, targetType: e.target.value as any, targetIds: [] }))}
                    className="mr-2"
                  />
                  Bạn bè
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="targetType"
                    value="groups"
                    checked={contentForm.targetType === 'groups'}
                    onChange={(e) => setContentForm(prev => ({ ...prev, targetType: e.target.value as any, targetIds: [] }))}
                    className="mr-2"
                  />
                  Nhóm
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="targetType"
                    value="both"
                    checked={contentForm.targetType === 'both'}
                    onChange={(e) => setContentForm(prev => ({ ...prev, targetType: e.target.value as any, targetIds: [] }))}
                    className="mr-2"
                  />
                  Cả hai
                </label>
              </div>

              <div className="max-h-32 overflow-y-auto border border-secondary-300 rounded-lg">
                {(contentForm.targetType === 'friends' || contentForm.targetType === 'both') && 
                  friends.map(friend => (
                    <label key={friend.id} className="flex items-center p-2 hover:bg-secondary-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentForm.targetIds.includes(friend.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setContentForm(prev => ({ ...prev, targetIds: [...prev.targetIds, friend.id] }))
                          } else {
                            setContentForm(prev => ({ ...prev, targetIds: prev.targetIds.filter(id => id !== friend.id) }))
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{friend.displayName || friend.name}</span>
                    </label>
                  ))
                }
                
                {(contentForm.targetType === 'groups' || contentForm.targetType === 'both') && 
                  groups.map(group => (
                    <label key={group.id} className="flex items-center p-2 hover:bg-secondary-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentForm.targetIds.includes(group.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setContentForm(prev => ({ ...prev, targetIds: [...prev.targetIds, group.id] }))
                          } else {
                            setContentForm(prev => ({ ...prev, targetIds: prev.targetIds.filter(id => id !== group.id) }))
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{group.name}</span>
                    </label>
                  ))
                }
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={contentForm.isScheduled}
                onChange={(e) => setContentForm(prev => ({ ...prev, isScheduled: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-secondary-700">Lên lịch chia sẻ</span>
            </label>
          </div>

          {contentForm.isScheduled && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Ngày"
                type="date"
                value={contentForm.scheduledDate}
                onChange={(e) => setContentForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
              <Input
                label="Giờ"
                type="time"
                value={contentForm.scheduledTime}
                onChange={(e) => setContentForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
              />
            </div>
          )}
          
          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowContentModal(false)}
            >
              Hủy
            </Button>
            <Button onClick={handleCreateContent}>
              {contentForm.isScheduled ? 'Lên lịch' : 'Tạo nội dung'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ShareContent
