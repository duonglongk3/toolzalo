import React from 'react'
import { Send, Clock, MessageSquare, FileText, Users } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Modal, Input } from '@/components/ui'
import TemplateSelector from '@/components/TemplateSelector'
import { useTemplateStore, useAccountStore, useFriendsStore } from '@/store'
import { zaloService } from '@/services'
import type { MessageTemplate, MediaAttachment, ZaloLabel } from '@/types'
import toast from 'react-hot-toast'
import { formatRelativeTime } from '@/utils'


interface MessageJob {
  id: string
  templateId: string
  recipients: string[]
  status: 'pending' | 'sending' | 'completed' | 'failed'
  sentCount: number
  totalCount: number
  createdAt: Date
  completedAt?: Date
  errors: string[]
  mode: 'normal' | 'forward'
}

const PersonalMessages: React.FC = () => {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplateStore()
  const { activeAccount } = useAccountStore()
  const { friends } = useFriendsStore()
  const [showTemplateModal, setShowTemplateModal] = React.useState(false)
  const [showSendModal, setShowSendModal] = React.useState(false)
  const [selectedTemplate, setSelectedTemplate] = React.useState<MessageTemplate | null>(null)
  const [selectedFriends, setSelectedFriends] = React.useState<string[]>([])
  const [messageJobs, setMessageJobs] = React.useState<MessageJob[]>([])
  const [delay, setDelay] = React.useState(30000)
  const [sendMode, setSendMode] = React.useState<'normal' | 'forward'>('normal')
  // Nhập SĐT để gửi trực tiếp (resolve -> userId)
  const [phoneList, setPhoneList] = React.useState('')
  const [userIdList, setUserIdList] = React.useState('')
  const [resolvingPhones, setResolvingPhones] = React.useState(false)
  // Checkbox: Kết bạn trước khi gửi
  const [addFriendBeforeSend, setAddFriendBeforeSend] = React.useState(false)

  // Labels state for selecting recipients by tags
  const [labels, setLabels] = React.useState<Array<{ id: number; text: string; conversations: string[] }>>([])
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<number[]>([])
  const [labelsLoading, setLabelsLoading] = React.useState(false)

  // Fetch labels when opening Send Modal
  React.useEffect(() => {
    if (!showSendModal) return
    let cancelled = false
    ;(async () => {
      try {
        setLabelsLoading(true)
        // Ensure login to call label APIs
        await zaloService.refreshLoginState()
        if (!zaloService.isLoggedIn() && activeAccount) {
          await zaloService.login({
            imei: activeAccount.imei,
            cookie: activeAccount.cookie,
            userAgent: activeAccount.userAgent,
          } as any)
        }
        const res = await zaloService.getLabels()
        const data = (res?.labelData || []) as any[]
        if (!cancelled) {
          setLabels(data.map(l => ({
            id: Number(l?.id),
            text: String(l?.text || l?.textKey || ''),
            conversations: Array.isArray(l?.conversations) ? l.conversations.map((c: any) => String(c)) : [],
          })))
        }
      } catch (e) {
        console.warn('⚠️ getLabels failed:', e)
      } finally {
        if (!cancelled) setLabelsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [showSendModal, activeAccount])

  // Apply selected labels to recipients
  const applySelectedLabels = React.useCallback(() => {
    const idSet = new Set<string>()
    for (const lid of selectedLabelIds) {
      const lb = labels.find(l => l.id === lid)
      if (!lb) continue
      for (const c of (lb.conversations || [])) {
        const base = String(c).split('_')[0]
        if (base) idSet.add(base)
      }
    }
    const friendIdSet = new Set((friends || []).map(f => String(f.id)))
    const toSelect = Array.from(idSet).filter(id => friendIdSet.has(id))
    setSelectedFriends(toSelect)
  }, [selectedLabelIds, labels, friends])

  React.useEffect(() => {
    if (selectedLabelIds.length > 0) applySelectedLabels()
  }, [selectedLabelIds, applySelectedLabels])

  // Template form
  const [templateForm, setTemplateForm] = React.useState({
    name: '',
    content: '',
    category: 'personal',
    media: [] as MediaAttachment[],
  })
  const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null)

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', content: '', category: 'personal', media: [] })
  }

  const openCreateTemplate = () => {
    setEditingTemplate(null)
    resetTemplateForm()
    setShowTemplateModal(true)
  }

  const openEditTemplate = (tpl: MessageTemplate) => {
    setEditingTemplate(tpl)
    setTemplateForm({
      name: tpl.name,
      content: tpl.content,
      category: (tpl as any).category || (tpl.type === 'group' ? 'group' : 'personal'),
      media: tpl.media || []
    })
    setShowTemplateModal(true)
  }

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin')
      return
    }

    updateTemplate(editingTemplate.id, {
      name: templateForm.name.trim(),
      content: templateForm.content.trim(),
      variables: extractVariables(templateForm.content),
      media: templateForm.media,
      // giữ nguyên type hiện có, đồng bộ category nếu dùng ở trang này
      category: templateForm.category as any,
    } as any)

    toast.success('Đã cập nhật template')
    setShowTemplateModal(false)
    setEditingTemplate(null)
    resetTemplateForm()
  }

  const handleCreateTemplate = () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin')
      return
    }

    addTemplate({
      name: templateForm.name.trim(),
      content: templateForm.content.trim(),
      category: templateForm.category as any,
      variables: extractVariables(templateForm.content),
      media: templateForm.media,
    })

    toast.success('Đã tạo template')
    resetTemplateForm()
    setShowTemplateModal(false)
  }

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{([^}]+)\}/g)
    return matches ? matches.map(match => match.slice(1, -1)) : []
  }

  // Media helpers for template form
  const electronAPI: any = (window as any).electronAPI || null
  const determineKind = (filePath: string): 'image' | 'video' | 'file' => {
    const ext = (filePath.split('.').pop() || '').toLowerCase()
    const img = ['jpg','jpeg','png','gif','webp']
    const vid = ['mp4','mov','avi','mkv','webm']
    if (img.includes(ext)) return 'image'
    if (vid.includes(ext)) return 'video'
    return 'file'
  }
  const handlePickMedia = async () => {
    try {
      const res = await electronAPI?.dialog?.showOpenDialog?.({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Media', extensions: ['jpg','jpeg','png','gif','webp','mp4','mov','avi','mkv','webm','pdf'] },
          { name: 'Tất cả', extensions: ['*'] }
        ]
      })
      if (!res || res.canceled || !res.filePaths?.length) return
      const files: MediaAttachment[] = res.filePaths.map((p: string) => ({
        id: crypto.randomUUID(),
        name: p.split(/\\|\//).pop() || 'media',
        path: p,
        kind: determineKind(p),
      }))
      setTemplateForm(prev => ({ ...prev, media: [...(prev.media || []), ...files] }))
    } catch (e) {
      console.error('Pick media error:', e)
      toast.error('Không thể chọn media')
    }
  }
  const handleRemoveMedia = (id: string) => {
    setTemplateForm(prev => ({ ...prev, media: (prev.media || []).filter(m => m.id !== id) }))
  }

  // Resolve danh sách số điện thoại -> userId để gửi trực tiếp
  const resolvePhonesToRecipients = async (phonesText: string): Promise<string[]> => {
    const lines = Array.from(new Set(
      (phonesText || '')
        .split(/\r?\n|[,;\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
    ))
    if (lines.length === 0) return []

    await zaloService.refreshLoginState()
    if (!zaloService.isLoggedIn() && activeAccount) {
      const ok = await zaloService.login({
        imei: activeAccount.imei,
        cookie: activeAccount.cookie,
        userAgent: activeAccount.userAgent,
      } as any)
      if (!ok) {
        toast.error('Đăng nhập Zalo thất bại, không thể dò số điện thoại')
        return []
      }
    }

    setResolvingPhones(true)
    const found: string[] = []
    let notFound = 0
    try {
      for (const ph of lines) {
        const { userId } = await zaloService.findUser(ph)
        if (userId) found.push(String(userId))
        else notFound++
      }
    } finally {
      setResolvingPhones(false)
    }

    if (found.length) toast.success(`Tìm được ${found.length} userId từ ${lines.length} số`)
    if (notFound) toast(`Không tìm thấy ${notFound} số`, { icon: 'ℹ️' })

    return found
  }

  // Parse và validate danh sách User ID
  const parseUserIdList = (userIdsText: string): string[] => {
    const lines = Array.from(new Set(
      (userIdsText || '')
        .split(/\r?\n|[,;\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(id => /^\d+$/.test(id)) // Chỉ lấy những ID là số
    ))
    return lines
  }

  // Tính toán số lượng người nhận
  const hasRecipients = React.useMemo(() => {
    const hasSelectedFriends = selectedFriends.length > 0
    const hasUserIds = userIdList.trim().length > 0
    const hasPhones = phoneList.trim().length > 0
    return hasSelectedFriends || hasUserIds || hasPhones
  }, [selectedFriends.length, userIdList, phoneList])

  // Thêm User ID trực tiếp vào danh sách người nhận
  const handleSendMessages = async () => {
    if (!selectedTemplate) {
      toast.error('Vui lòng chọn template')
      return
    }

    // Tự động parse User ID từ textarea nếu có
    const userIdsFromTextarea = parseUserIdList(userIdList)
    const phoneIdsFromTextarea = phoneList.trim() ? await resolvePhonesToRecipients(phoneList) : []

    // Tổng hợp tất cả recipients
    const allRecipients = Array.from(new Set([
      ...selectedFriends,
      ...userIdsFromTextarea,
      ...phoneIdsFromTextarea
    ]))

    if (allRecipients.length === 0) {
      toast.error('Vui lòng chọn người nhận hoặc nhập User ID/số điện thoại')
      return
    }


    if (!activeAccount) {
      toast.error('Vui lòng chọn tài khoản')
      return
    }

    // Bắt buộc đăng nhập cho chức năng gửi tin: đồng bộ trạng thái và tự đăng nhập nếu cần
    await zaloService.refreshLoginState()
    if (!zaloService.isLoggedIn()) {
      toast.loading('Đang đăng nhập...', { id: 'auto-login' })
      const ok = await zaloService.login({
        imei: activeAccount.imei,
        cookie: activeAccount.cookie,
        userAgent: activeAccount.userAgent,
      } as any)
      toast.dismiss('auto-login')
      if (!ok) {
        toast.error('Đăng nhập thất bại, vui lòng kiểm tra tài khoản')
        return
      }
    }

    // Lọc bỏ userId của chính mình (không thể tự gửi tin nhắn cho chính mình)
    const currentUserId = zaloService.getCurrentUserId()
    if (currentUserId) {
      const beforeFilter = allRecipients.length
      const filteredRecipients = allRecipients.filter(id => id !== currentUserId)
      if (filteredRecipients.length < beforeFilter) {
        toast.error('Không thể gửi tin nhắn cho chính mình')
        return
      }
    }

    const jobId = Date.now().toString()
    const newJob: MessageJob = {
      id: jobId,
      templateId: selectedTemplate.id,
      recipients: [...allRecipients],
      status: 'pending',
      sentCount: 0,
      totalCount: allRecipients.length,
      createdAt: new Date(),
      errors: [],
      mode: sendMode,
    }

    setMessageJobs(prev => [newJob, ...prev])
    setShowSendModal(false)
    setSelectedFriends([])
    setSelectedTemplate(null)
    setUserIdList('') // Clear User ID list
    setPhoneList('') // Clear phone list

    // Start sending messages
    await processMessageJob(newJob)
  }

  const processMessageJob = async (job: MessageJob) => {
    setMessageJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, status: 'sending' } : j
    ))

    let sentCount = 0
    const errors: string[] = []
    // Chế độ forward thông minh (gửi 1 người đầu bằng sendMessage, sau đó forward số còn lại)
    // Thực hiện theo lô nếu có >= 2 người để tận dụng API forward đa người và logic ở main
    if (job.mode === 'forward' && job.recipients.length >= 2) {
      try {
        const template = templates.find(t => t.id === job.templateId)
        if (!template) throw new Error('Template không tồn tại')
        const firstId = job.recipients[0]
        const friend0 = friends.find(f => f.id === firstId)
        if (!friend0) throw new Error(`Không tìm thấy người nhận ${firstId}`)
        // Build message theo người đầu tiên
        let message = template.content
        message = message.replace(/\{name\}/g, friend0.displayName || friend0.name)
        message = message.replace(/\{phone\}/g, friend0.phone || '')
        // Gom attachments từ template media + chuỗi message (đường dẫn cục bộ)
        const media = template.media || []
        const attachmentPathsFromTemplate = media.filter(m => m.path && !/^https?:\/\//.test(m.path)).map(m => m.path)
        const contentFileMatches = Array.from(message.matchAll(/[A-Za-z]:\\[^\s]+?\.(png|jpg|jpeg|gif|webp|mp4|mov|avi|mkv|webm|pdf)/gi)).map(m => m[0])
        const attachmentsAll = Array.from(new Set([...(attachmentPathsFromTemplate||[]), ...(contentFileMatches||[])]))
        try { console.log('🧪 personal.forward-bulk', { count: job.recipients.length, attachments: attachmentsAll.length }) } catch {}
        const ok = await zaloService.forwardMessage({ message, attachments: attachmentsAll }, job.recipients, 'user')
        sentCount = ok ? job.recipients.length : 0
        if (!ok) errors.push('Forward thất bại')
      } catch (e: any) {
        errors.push(e?.message || String(e))
      }
      setMessageJobs(prev => prev.map(j => j.id === job.id ? { ...j, sentCount, status: errors.length ? 'failed' : 'completed', completedAt: new Date(), errors: [...(j.errors||[]), ...errors] } : j))
      return
    }


    for (const recipientId of job.recipients) {
      try {
        // Lấy template và friend info
        const template = templates.find(t => t.id === job.templateId)
        if (!template) {
          errors.push(`Template không tồn tại cho User ${recipientId}`)
          continue
        }
        const friend = friends.find(f => f.id === recipientId)

        // Kết bạn trước khi gửi (nếu được bật)
        if (addFriendBeforeSend) {
          try {
            // API signature: sendFriendRequest(message, userId)
            await zaloService.sendFriendRequest('', recipientId)
            console.log('✅ Đã gửi lời mời kết bạn cho:', recipientId)
            // Đợi 500ms để request được xử lý
            await new Promise(r => setTimeout(r, 500))
          } catch (e) {
            // Bỏ qua lỗi kết bạn, vẫn tiếp tục gửi tin
            console.warn('⚠️ Kết bạn thất bại, vẫn tiếp tục gửi tin:', e)
          }
        }

        let message = template.content
        const fallbackName = friend?.displayName || friend?.name || `User ${recipientId}`
        const fallbackPhone = friend?.phone || ''
        message = message.replace(/\{name\}/g, fallbackName)
        message = message.replace(/\{phone\}/g, fallbackPhone)

        // Quyết định API theo sendMode
        let success = false

        // Phân tích media/link/attachments trước để forward cũng có thể gửi kèm file
        const urlMatch = message.match(/https?:\/\/\S+/)
        const media = template.media || []
        console.log('🧪 personal.template.media', media)
        const videoUrl = media.find(m => m.kind === 'video' && /^https?:\/\//.test(m.path))?.path
        const attachmentPathsFromTemplate = media
          .filter(m => m.path && !/^https?:\/\//.test(m.path))
          .map(m => m.path)
        const contentFileMatches = Array.from(message.matchAll(/[A-Za-z]:\\[^\s]+?\.(png|jpg|jpeg|gif|webp|mp4|mov|avi|mkv|webm|pdf)/gi)).map(m => m[0])
        const attachmentsAll = Array.from(new Set([...(attachmentPathsFromTemplate||[]), ...(contentFileMatches||[])]))
        try { console.log('🧪 personal.attachmentsAll(forward-path)', { sendMode, count: attachmentsAll.length, attachmentsAll }) } catch {}

        if (job.mode === 'forward') {
          if (attachmentsAll.length > 0) {
            // Forward mode nhưng có tệp -> gọi forwardMessage kèm attachments để main fallback gửi file
            console.log('🧪 forwardMode -> forwardMessage with attachments', attachmentsAll)
            success = await zaloService.forwardMessage({ message, attachments: attachmentsAll }, [recipientId], 'user')
            if (!success) {
              // Fallback cuối cùng: thử sendMessage như gửi thường
              success = await zaloService.sendMessage(recipientId, message, 'user', attachmentsAll)
              if (!success) success = await zaloService.sendMessage(recipientId, message, 'user')
            }
          } else {
            success = await zaloService.forwardMessage({ message }, [recipientId], 'user')
          }
        } else {
          // Bình thường: ưu tiên file đính kèm -> video URL -> link -> văn bản
          console.log('🧪 personal.attachmentsAll', attachmentsAll)

          // Kiểm tra xem có phải bạn bè không
          const isFriend = !!friend

          if (attachmentsAll.length > 0) {
            // Thử gửi với attachments
            success = await zaloService.sendMessage(recipientId, message, 'user', attachmentsAll)

            // Nếu thất bại, thử gửi chỉ text (không có attachments)
            if (!success) {
              console.warn('⚠️ Gửi file thất bại, thử gửi chỉ text...')
              success = await zaloService.sendMessage(recipientId, message, 'user')
            }
          } else if (videoUrl) {
            success = await zaloService.sendVideo(recipientId, videoUrl, videoUrl, { msg: message }, 'user')
            if (!success) success = await zaloService.sendMessage(recipientId, message, 'user')
          } else if (urlMatch) {
            const link = urlMatch[0]
            const msgWithoutLink = message.replace(link, '').trim()
            success = await zaloService.sendLink(recipientId, link, msgWithoutLink || undefined, 'user')
            if (!success) success = await zaloService.sendMessage(recipientId, message, 'user')
          } else {
            success = await zaloService.sendMessage(recipientId, message, 'user')
          }
        }

        if (success) {
          sentCount++
        } else {
          const recipientName = friend?.name || friend?.displayName || `User ${recipientId}`
          errors.push(`Gửi thất bại cho ${recipientName}`)
        }

        // Update progress
        setMessageJobs(prev => prev.map(j =>
          j.id === job.id ? { ...j, sentCount, errors: [...errors] } : j
        ))

        // Add delay between messages
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }

      } catch (error) {
        console.error('Send message error:', error)
        const recipientName = friends.find(f => f.id === recipientId)?.name || `User ${recipientId}`
        errors.push(`Lỗi gửi tin cho ${recipientName}: ${error}`)
      }
    }

    // Mark job as completed
    setMessageJobs(prev => prev.map(j =>
      j.id === job.id ? {
        ...j,
        status: sentCount > 0 ? 'completed' : 'failed',
        sentCount,
        errors,
        completedAt: new Date()
      } : j
    ))

    toast.success(`Đã gửi ${sentCount}/${job.totalCount} tin nhắn`)
  }

  const personalTemplates = templates.filter(t => t.category === 'personal')

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Nhắn tin cá nhân</h1>
          <p className="text-secondary-600 mt-1">
            Gửi tin nhắn cá nhân đến bạn bè với template có sẵn
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={openCreateTemplate}
            icon={<FileText className="w-4 h-4" />}
          >
            Tạo template
          </Button>
          <Button
            onClick={() => setShowSendModal(true)}
            disabled={personalTemplates.length === 0 || friends.length === 0}
            icon={<Send className="w-4 h-4" />}
          >
            Gửi tin nhắn
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Templates</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {personalTemplates.length}
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
                <p className="text-sm text-secondary-600">Bạn bè</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {friends.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-info-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Đã gửi hôm nay</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {messageJobs.reduce((sum, job) => sum + job.sentCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Clock className="w-5 h-5 text-warning-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Đang xử lý</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {messageJobs.filter(job => job.status === 'sending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates tin nhắn</CardTitle>
        </CardHeader>
        <CardContent>
          {personalTemplates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">
                Chưa có template nào
              </h3>
              <p className="text-secondary-600 mb-4">
                Tạo template đầu tiên để bắt đầu gửi tin nhắn
              </p>
              <Button onClick={openCreateTemplate}>
                Tạo template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personalTemplates.map((template) => (
                <Card key={template.id} className="border border-secondary-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-secondary-900">
                        {template.name}
                      </h4>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditTemplate(template)}
                          className="p-1"
                        >
                          Sửa
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                          className="p-1 text-error-600 hover:text-error-700"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-secondary-600 mb-3 line-clamp-3">
                      {template.content}
                    </p>
                    {template.variables?.length ? (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {template.variables.map(variable => (
                          <Badge key={variable} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="text-xs text-secondary-500">
                      Tạo: {formatRelativeTime(template.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Jobs */}
      {messageJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử gửi tin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messageJobs.map((job) => {
                const template = templates.find(t => t.id === job.templateId)
                const statusColor = {
                  pending: 'warning',
                  sending: 'info',
                  completed: 'success',
                  failed: 'error'
                }[job.status] as any

                return (
                  <div key={job.id} className="border border-secondary-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge variant={statusColor}>
                          {job.status === 'pending' && 'Chờ xử lý'}
                          {job.status === 'sending' && 'Đang gửi'}
                          {job.status === 'completed' && 'Hoàn thành'}
                          {job.status === 'failed' && 'Thất bại'}
                        </Badge>
                        <span className="font-medium text-secondary-900">
                          {template?.name || 'Template đã xóa'}
                        </span>
                      </div>
                      <div className="text-sm text-secondary-600">
                        {job.sentCount}/{job.totalCount} tin nhắn
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-secondary-600">
                      <span>Tạo: {formatRelativeTime(job.createdAt)}</span>
                      {job.completedAt && (
                        <span>Hoàn thành: {formatRelativeTime(job.completedAt)}</span>
                      )}
                    </div>

                    {job.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-error-50 rounded text-sm text-error-700">
                        <strong>Lỗi:</strong>
                        <ul className="mt-1 list-disc list-inside">
                          {job.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {job.errors.length > 3 && (
                            <li>... và {job.errors.length - 3} lỗi khác</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Template Modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); resetTemplateForm(); }}
        title={editingTemplate ? 'Sửa template tin nhắn' : 'Tạo template tin nhắn'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Tên template"
            placeholder="Ví dụ: Chào hỏi khách hàng"
            value={templateForm.name}
            onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Nội dung tin nhắn
            </label>
            <textarea
              value={templateForm.content}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Xin chào {name}, bạn có khỏe không?"
              rows={6}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-secondary-500 mt-1">
              Sử dụng {'{name}'} và {'{phone}'} để thay thế thông tin người nhận
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Media đính kèm (tùy chọn)
            </label>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" onClick={handlePickMedia}>Chọn media (nhiều)</Button>
              {templateForm.media?.length ? (
                <span className="text-xs text-secondary-500">{templateForm.media.length} tệp</span>
              ) : (
                <span className="text-xs text-secondary-500">Chưa chọn tệp</span>
              )}
            </div>
            {templateForm.media?.length ? (
              <div className="flex flex-wrap gap-2">
                {templateForm.media.map(m => (
                  <div key={m.id} className="px-2 py-1 rounded-full bg-secondary-100 text-secondary-700 text-xs flex items-center gap-2">
                    <span className="capitalize">{m.kind}</span>
                    <span className="max-w-[160px] truncate">{m.name}</span>
                    <button
                      type="button"
                      className="ml-1 text-secondary-500 hover:text-secondary-700"
                      onClick={() => handleRemoveMedia(m.id)}
                      aria-label={`Xóa ${m.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowTemplateModal(false)}
            >
              Hủy
            </Button>
            <Button onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}>
              {editingTemplate ? 'Lưu thay đổi' : 'Tạo template'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Messages Modal */}
      <Modal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Gửi tin nhắn cá nhân"
        size="xl"
      >
        <div className="space-y-6">
          {/* Template Selection */}
          <TemplateSelector
            templates={personalTemplates}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
          />

          {selectedTemplate && (
            <div className="p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg">
              <p className="text-sm text-secondary-700 dark:text-secondary-300">{selectedTemplate.content}</p>
            </div>
          )}

          {/* Total Recipients Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">Tổng số người nhận</h3>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {selectedFriends.length} bạn bè + {parseUserIdList(userIdList).length} User ID + {phoneList.trim().split(/\r?\n|[,;\s]+/).filter(Boolean).length} số điện thoại
                </p>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Array.from(new Set([...selectedFriends, ...parseUserIdList(userIdList)])).length + phoneList.trim().split(/\r?\n|[,;\s]+/).filter(Boolean).length}
              </div>
            </div>
          </div>

          {/* Recipients Selection - 4 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Column 1: Select by Labels */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Chọn theo nhãn
              </label>
              <div className="max-h-64 overflow-y-auto border border-secondary-300 dark:border-secondary-600 rounded-lg p-2 bg-white dark:bg-secondary-800">
                {labelsLoading ? (
                  <div className="text-sm text-secondary-500 dark:text-secondary-400 p-2">Đang tải nhãn...</div>
                ) : labels.length === 0 ? (
                  <div className="text-sm text-secondary-500 dark:text-secondary-400 p-2">Không có nhãn</div>
                ) : (
                  labels.map(lb => {
                    const friendIds = new Set((friends || []).map(f => String(f.id)))
                    const count = (lb.conversations || []).reduce((acc, cid) => {
                      const base = String(cid).split('_')[0]
                      return acc + (friendIds.has(base) ? 1 : 0)
                    }, 0)
                    const checked = selectedLabelIds.includes(lb.id)
                    return (
                      <label key={lb.id} className="flex items-center p-2 hover:bg-secondary-50 dark:hover:bg-secondary-700 cursor-pointer rounded">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedLabelIds(prev => e.target.checked ? [...prev, lb.id] : prev.filter(id => id !== lb.id))
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-secondary-900 dark:text-secondary-100">
                          {lb.text}
                          <span className="text-secondary-500 dark:text-secondary-400 ml-1">({count})</span>
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                Chọn nhãn để tự động chọn người nhận
              </p>
            </div>

            {/* Column 2: Select Recipients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
                  Danh sách người nhận ({selectedFriends.length})
                </label>
                {selectedFriends.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFriends([])}
                    className="text-xs px-2 py-1 h-6"
                  >
                    Xóa tất cả
                  </Button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800">
                {/* Hiển thị bạn bè */}
                {friends.map(friend => (
                  <label key={friend.id} className="flex items-center p-2 hover:bg-secondary-50 dark:hover:bg-secondary-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(friend.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFriends(prev => [...prev, friend.id])
                        } else {
                          setSelectedFriends(prev => prev.filter(id => id !== friend.id))
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-secondary-900 dark:text-secondary-100">
                      {friend.displayName || friend.name}
                      {friend.phone && (
                        <span className="text-secondary-500 dark:text-secondary-400 ml-1">({friend.phone})</span>
                      )}
                    </span>
                  </label>
                ))}

                {/* Hiển thị User ID không có trong danh sách bạn bè */}
                {selectedFriends
                  .filter(id => !friends.some(f => f.id === id))
                  .map(userId => (
                    <div key={userId} className="flex items-center p-2 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400">
                      <button
                        onClick={() => setSelectedFriends(prev => prev.filter(id => id !== userId))}
                        className="mr-2 w-4 h-4 text-red-500 hover:text-red-700 flex items-center justify-center"
                        title="Xóa khỏi danh sách"
                      >
                        ×
                      </button>
                      <span className="text-sm text-blue-900 dark:text-blue-100">
                        User ID: {userId}
                        <span className="text-blue-600 dark:text-blue-400 ml-1 text-xs">(từ danh sách)</span>
                      </span>
                    </div>
                  ))
                }

                {selectedFriends.length === 0 && (
                  <div className="p-4 text-center text-secondary-500 dark:text-secondary-400 text-sm">
                    Chưa chọn người nhận nào
                  </div>
                )}
              </div>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                Bạn bè + User ID từ số điện thoại/danh sách
              </p>
            </div>

            {/* Column 3: Phone numbers */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Danh sách số điện thoại
              </label>
              <textarea
                value={phoneList}
                onChange={(e) => setPhoneList(e.target.value)}
                placeholder="VD:\n0987654321\n0912345678\n..."
                rows={10}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100"
              />
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs text-secondary-500 dark:text-secondary-400">
                  Hệ thống sẽ dò userId từ số điện thoại rồi thêm vào danh sách người nhận.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!phoneList.trim()) { toast.error('Vui lòng nhập danh sách số điện thoại'); return }
                    const ids = await resolvePhonesToRecipients(phoneList)
                    if (ids.length > 0) {
                      setSelectedFriends(prev => Array.from(new Set([...(prev||[]), ...ids])))
                    }
                  }}
                  loading={resolvingPhones}
                  className="w-full"
                >
                  Thêm từ số điện thoại
                </Button>
              </div>
            </div>

            {/* Column 4: User IDs */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Danh sách User ID
              </label>
              <textarea
                value={userIdList}
                onChange={(e) => setUserIdList(e.target.value)}
                placeholder="VD:\n1234567890123456\n9876543210987654\n..."
                rows={10}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100"
              />
              <div className="text-xs text-secondary-500 dark:text-secondary-400 space-y-1 mt-2">
                <p>• Nhập trực tiếp User ID (chỉ số), mỗi dòng một ID</p>
                <p>• User ID thường dài 10-16 chữ số</p>
                <p>• Có thể copy từ tính năng "Xem thành viên" của nhóm</p>
                <p className="text-green-600 dark:text-green-400 font-medium">
                  ✨ Tự động gửi - Nhấn "Gửi tin nhắn" để gửi thẳng
                </p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                Kiểu gửi
              </label>
              <select
                value={sendMode}
                onChange={(e) => setSendMode(e.target.value as 'normal'|'forward')}
                className="w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="normal">Bình thường</option>
                <option value="forward">Forward message</option>
              </select>
            </div>

            <div>
              <Input
                label="Delay giữa các tin nhắn (s)"
                type="number"
                value={Math.round(delay / 1000)}
                onChange={(e) => setDelay(Math.max(0, Number(e.target.value) || 0) * 1000)}
                min={0}
                step={1}
              />
            </div>

          {/* Checkbox: Kết bạn trước khi gửi */}
          <div className="col-span-full">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={addFriendBeforeSend}
                onChange={(e) => setAddFriendBeforeSend(e.target.checked)}
                className="w-4 h-4 text-primary-600 bg-white dark:bg-secondary-700 border-secondary-300 dark:border-secondary-600 rounded focus:ring-primary-500 focus:ring-2"
              />
              <div>
                <span className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                  Kết bạn trước khi gửi tin nhắn
                </span>
                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">
                  Tự động gửi lời mời kết bạn trước khi gửi tin nhắn (bỏ qua nếu đã là bạn bè)
                </p>
              </div>
            </label>
          </div>

          </div>


          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowSendModal(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSendMessages}
              disabled={!selectedTemplate || !hasRecipients}
            >
              Gửi tin nhắn
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PersonalMessages
