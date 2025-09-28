import React from 'react'
import { Send, Calendar, Users, FileText, Play, RotateCcw } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Modal, Input } from '@/components/ui'
import TemplateSelector from '@/components/TemplateSelector'
import { useTemplateStore, useGroupsStore, useAccountStore } from '@/store'
import { formatRelativeTime } from '@/utils'
import { zaloService } from '@/services'
import type { MessageTemplate, MediaAttachment } from '@/types'
import toast from 'react-hot-toast'

interface GroupMessageJob {
  id: string
  templateId: string
  groupIds: string[]
  status: 'pending' | 'sending' | 'completed' | 'failed' | 'scheduled'
  sentCount: number
  totalCount: number
  scheduledAt?: Date
  createdAt: Date
  completedAt?: Date
  errors: string[]
  // Lặp lại
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'interval'
  intervalHours?: number
  occurrencesLeft?: number
}

const GroupMessages: React.FC = () => {
  const { templates, addTemplate, deleteTemplate } = useTemplateStore()
  const { groups } = useGroupsStore()
  const { activeAccount } = useAccountStore()
  const [showTemplateModal, setShowTemplateModal] = React.useState(false)
  const [showSendModal, setShowSendModal] = React.useState(false)
  const [selectedTemplate, setSelectedTemplate] = React.useState<MessageTemplate | null>(null)
  const [selectedGroups, setSelectedGroups] = React.useState<string[]>([])
  const [messageJobs, setMessageJobs] = React.useState<GroupMessageJob[]>([])
  const [delay, setDelay] = React.useState(30000)
  const [isScheduled, setIsScheduled] = React.useState(false)
  // Lên lịch lặp lại
  const [recurrence, setRecurrence] = React.useState<'none'|'daily'|'weekly'|'monthly'|'interval'>('none')
  const [repeatCount, setRepeatCount] = React.useState<number>(1)
  const [intervalHours, setIntervalHours] = React.useState<number>(12)

  const [scheduledDate, setScheduledDate] = React.useState('')
  const [scheduledTime, setScheduledTime] = React.useState('')
  const [sendMode, setSendMode] = React.useState<'normal' | 'forward'>('normal')

  // Template form
  const [templateForm, setTemplateForm] = React.useState({
    name: '',
    content: '',
    category: 'group',
    media: [] as MediaAttachment[],
  })

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', content: '', category: 'group', media: [] })
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

  const handleSendMessages = async () => {
    if (!selectedTemplate) {
      toast.error('Vui lòng chọn template')
      return
    }

    if (selectedGroups.length === 0) {
      toast.error('Vui lòng chọn nhóm')
      return
    }

    if (!activeAccount) {
      toast.error('Vui lòng chọn tài khoản')
      return
    }

    // Bắt buộc đăng nhập cho chức năng gửi tin: đồng bộ và tự đăng nhập nếu cần
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

    let scheduledAt: Date | undefined
    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        toast.error('Vui lòng chọn thời gian lên lịch')
        return
      }
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
      if (scheduledAt <= new Date()) {
        toast.error('Thời gian lên lịch phải trong tương lai')
        return
      }
      if (recurrence === 'interval') {
        if (!Number.isFinite(intervalHours) || intervalHours < 1) {
          toast.error('Khoảng lặp (giờ) phải ≥ 1')
          return
        }
      }
    }

    const jobId = Date.now().toString()
    const repeatTimes = isScheduled && recurrence !== 'none' ? Math.max(1, Number(repeatCount) || 1) : 1
    const newJob: GroupMessageJob = {
      id: jobId,
      templateId: selectedTemplate.id,
      groupIds: [...selectedGroups],
      status: isScheduled ? 'scheduled' : 'pending',
      sentCount: 0,
      totalCount: selectedGroups.length,
      scheduledAt,
      createdAt: new Date(),
      errors: [],
      recurrence: isScheduled ? recurrence : 'none',
      intervalHours: recurrence === 'interval' ? intervalHours : undefined,
      occurrencesLeft: repeatTimes,
    }

    setMessageJobs(prev => [newJob, ...prev])
    setShowSendModal(false)
    setSelectedGroups([])
    setSelectedTemplate(null)
    setIsScheduled(false)
    setScheduledDate('')
    setScheduledTime('')
    setRecurrence('none')
    setRepeatCount(1)
    setIntervalHours(12)

    if (!isScheduled) {
      // Start sending immediately
      await processMessageJob(newJob)
    } else {
      toast.success(recurrence !== 'none' ? `Đã lên lịch ${repeatTimes} lần (${recurrence}${recurrence==='interval' ? `, mỗi ${intervalHours} giờ` : ''})` : 'Đã lên lịch gửi tin nhắn')
    }
  }

  const processMessageJob = async (job: GroupMessageJob) => {
    setMessageJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, status: 'sending' } : j
    ))

    let sentCount = 0
    const errors: string[] = []

    for (const groupId of job.groupIds) {
      try {
        const group = groups.find(g => g.id === groupId)
        if (!group) {
          errors.push(`Không tìm thấy nhóm ${groupId}`)
          continue
        }

        const template = templates.find(t => t.id === job.templateId)
        if (!template) {
          errors.push('Template không tồn tại')
          break
        }

        // Replace variables in template
        let message = template.content
        message = message.replace(/\{groupName\}/g, group.name)
        message = message.replace(/\{memberCount\}/g, group.memberCount.toString())

        // Quyết định API theo sendMode
        let success = false

        // Phân tích media/link/attachments trước để forward cũng có thể gửi kèm file
        const media = template.media || []
        const videoUrl = media.find(m => m.kind === 'video' && /^https?:\/\//.test(m.path))?.path
        const attachmentPathsFromTemplate = media
          .filter(m => m.path && !/^https?:\/\//.test(m.path))
          .map(m => m.path)
        const contentFileMatches = Array.from(message.matchAll(/[A-Za-z]:\\[^\s]+?\.(png|jpg|jpeg|gif|webp|mp4|mov|avi|mkv|webm|pdf)/gi)).map(m => m[0])
        const attachmentsAll = Array.from(new Set([...(attachmentPathsFromTemplate||[]), ...(contentFileMatches||[])]))
        try { console.log('\ud83e\uddea group.attachmentsAll(forward-path)', { sendMode, count: attachmentsAll.length, attachmentsAll }) } catch {}
        const urlMatch = message.match(/https?:\/\/\S+/)

        if (sendMode === 'forward') {
          if (attachmentsAll.length > 0) {
            // Forward mode nhưng có tệp -> gọi forwardMessage kèm attachments để main fallback upload
            console.log('\ud83e\udd2a forwardMode(group) -> forwardMessage with attachments', attachmentsAll)
            success = await zaloService.forwardMessage({ message, attachments: attachmentsAll }, [groupId], 'group')
            if (!success) {
              // Fallback: thử sendMessage như thường
              success = await zaloService.sendMessage(groupId, message, 'group', attachmentsAll)
              if (!success) success = await zaloService.sendMessage(groupId, message, 'group')
            }
          } else {
            success = await zaloService.forwardMessage({ message }, [groupId], 'group')
          }
        } else {
          // Bình thường: ưu tiên file đính kèm -> video URL -> link -> văn bản
          console.log('\ud83e\udd2a group.attachmentsAll', attachmentsAll)
          if (attachmentsAll.length > 0) {
            success = await zaloService.sendMessage(groupId, message, 'group', attachmentsAll)
            if (!success) success = await zaloService.sendMessage(groupId, message, 'group')
          } else if (videoUrl) {
            success = await zaloService.sendVideo(groupId, videoUrl, videoUrl, { msg: message }, 'group')
            if (!success) success = await zaloService.sendMessage(groupId, message, 'group')
          } else if (urlMatch) {
            const link = urlMatch[0]
            const msgWithoutLink = message.replace(link, '').trim()
            success = await zaloService.sendLink(groupId, link, msgWithoutLink || undefined, 'group')
            if (!success) success = await zaloService.sendMessage(groupId, message, 'group')
          } else {
            success = await zaloService.sendMessage(groupId, message, 'group')
          }
        }

        if (success) {
          sentCount++
        } else {
          errors.push(`Gửi thất bại cho nhóm ${group.name}`)
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
        console.error('Send group message error:', error)
        errors.push(`Lỗi gửi tin cho nhóm ${groupId}: ${error}`)
      }
    }

    // Ho0n tome: nu c f3 la1p la1i v e0 v e2n c f2n sd1 la7n, 11 eb t 1b8i tr ec trang th e1i 'scheduled' v e0 l ean lc1ch ti 19p theo
    const rec = job.recurrence && job.recurrence !== 'none' ? job.recurrence : undefined
    const left = typeof job.occurrencesLeft === 'number' ? job.occurrencesLeft : 1

    if (rec && left > 1 && job.scheduledAt) {
      const nextAt = (() => {
        const base = new Date(job.scheduledAt!)
        if (rec === 'daily') { base.setDate(base.getDate() + 1) }
        else if (rec === 'weekly') { base.setDate(base.getDate() + 7) }
        else if (rec === 'monthly') { base.setMonth(base.getMonth() + 1) }
        else if (rec === 'interval') { base.setHours(base.getHours() + (job.intervalHours || 1)) }
        return base
      })()

      setMessageJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        status: 'scheduled',
        sentCount: 0,
        errors: [],
        scheduledAt: nextAt,
        occurrencesLeft: Math.max(0, (j.occurrencesLeft || 1) - 1),
      } : j))
      toast.success(`Đã gửi ${sentCount}/${job.totalCount}. Lần tiếp theo: ${nextAt.toLocaleString('vi-VN')}`)


      return
    }

    // M ebc 11c9nh: 11 e1nh da5u ho e0n th e0nh / tha5t ba1i
    setMessageJobs(prev => prev.map(j =>
      j.id === job.id ? {
        ...j,
        status: sentCount > 0 ? 'completed' : 'failed',
        sentCount,
        errors,
        completedAt: new Date(),
        occurrencesLeft: 0,
      } : j
    ))

    toast.success(`Đã gửi ${sentCount}/${job.totalCount} tin nhắn nhóm`)
  }

  // Scheduler: tự động kiểm tra job đến hạn mỗi 15s
  React.useEffect(() => {
    const t = setInterval(() => {
      const now = new Date()
      const due = messageJobs.filter(j => j.status === 'scheduled' && j.scheduledAt && j.scheduledAt <= now)
      if (due.length) {
        due.forEach(j => { processMessageJob(j) })
      }
    }, 15000)
    return () => clearInterval(t)
  }, [messageJobs])


  const handleExecuteScheduledJob = async (job: GroupMessageJob) => {
    if (job.status !== 'scheduled') return
    await processMessageJob(job)
  }

  const handleCancelScheduledJob = (jobId: string) => {
    setMessageJobs(prev => prev.filter(j => j.id !== jobId))
    toast.success('Đã hủy lịch gửi tin nhắn')
  }

  const groupTemplates = templates.filter(t => t.category === 'group')

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Nhắn tin nhóm</h1>
          <p className="text-secondary-600 mt-1">
            Gửi tin nhắn đến nhiều nhóm cùng lúc với khả năng lên lịch
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowTemplateModal(true)}
            icon={<FileText className="w-4 h-4" />}
          >
            Tạo template
          </Button>
          <Button
            onClick={() => setShowSendModal(true)}
            disabled={groupTemplates.length === 0 || groups.length === 0}
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
                <p className="text-sm text-secondary-600">Templates nhóm</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {groupTemplates.length}
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
                <p className="text-sm text-secondary-600">Nhóm tham gia</p>
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
              <div className="p-2 bg-info-100 rounded-lg">
                <Send className="w-5 h-5 text-info-600" />
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
                <Calendar className="w-5 h-5 text-warning-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Đã lên lịch</p>
                <p className="text-xl font-semibold text-secondary-900">
                  {messageJobs.filter(job => job.status === 'scheduled').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates tin nhắn nhóm</CardTitle>
        </CardHeader>
        <CardContent>
          {groupTemplates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">
                Chưa có template nhóm nào
              </h3>
              <p className="text-secondary-600 mb-4">
                Tạo template đầu tiên để bắt đầu gửi tin nhắn nhóm
              </p>
              <Button onClick={() => setShowTemplateModal(true)}>
                Tạo template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupTemplates.map((template) => (
                <Card key={template.id} className="border border-secondary-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-secondary-900">
                        {template.name}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                        className="p-1 text-error-600 hover:text-error-700"
                      >
                        ×
                      </Button>
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
            <CardTitle>Lịch sử gửi tin nhóm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messageJobs.map((job) => {
                const template = templates.find(t => t.id === job.templateId)
                const statusColor = {
                  pending: 'warning',
                  sending: 'info',
                  completed: 'success',
                  failed: 'error',
                  scheduled: 'info'
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
                          {job.status === 'scheduled' && 'Đã lên lịch'}
                        </Badge>
                        <span className="font-medium text-secondary-900">
                          {template?.name || 'Template đã xóa'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-secondary-600">
                          {job.sentCount}/{job.totalCount} nhóm
                        </span>
                        {job.status === 'scheduled' && (
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExecuteScheduledJob(job)}
                              className="p-1"
                              title="Thực hiện ngay"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelScheduledJob(job.id)}
                              className="p-1 text-error-600"
                              title="Hủy lịch"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-secondary-600">
                      <span>Tạo: {formatRelativeTime(job.createdAt)}</span>
                      {job.scheduledAt && (
                        <span>Lên lịch: {job.scheduledAt.toLocaleString('vi-VN')}</span>
                      )}
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
        onClose={() => setShowTemplateModal(false)}
        title="Tạo template tin nhắn nhóm"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Tên template"
            placeholder="Ví dụ: Thông báo sự kiện"
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
              placeholder="Xin chào các thành viên nhóm {groupName}! Hiện tại nhóm có {memberCount} thành viên."
              rows={6}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-secondary-500 mt-1">
              Sử dụng {'{groupName}'} và {'{memberCount}'} để thay thế thông tin nhóm
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
            <Button onClick={handleCreateTemplate}>
              Tạo template
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Messages Modal */}
      <Modal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Gửi tin nhắn nhóm"
        size="lg"
      >
        <div className="space-y-4">
          {/* Template Selection */}
          <TemplateSelector
            templates={groupTemplates}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
          />

          {selectedTemplate && (
            <div className="p-3 bg-secondary-50 dark:bg-secondary-700 rounded-lg">
              <p className="text-sm text-secondary-700 dark:text-secondary-300">{selectedTemplate.content}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Chọn nhóm ({selectedGroups.length}/{groups.length})
            </label>
            <div className="max-h-48 overflow-y-auto border border-secondary-300 rounded-lg">


              {groups.map(group => (
                <label key={group.id} className="flex items-center p-2 hover:bg-secondary-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroups(prev => [...prev, group.id])
                      } else {
                        setSelectedGroups(prev => prev.filter(id => id !== group.id))
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {group.name}
                    <span className="text-secondary-500 ml-1">({group.memberCount} thành viên)</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-secondary-700">Lên lịch gửi</span>
            </label>
          </div>

          {isScheduled && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Ngày"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <Input
                label="Giờ"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Kiểu gửi
            </label>
            <select
              value={sendMode}
              onChange={(e) => setSendMode(e.target.value as 'normal'|'forward')}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="normal">Bình thường</option>
              <option value="forward">Forward message</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Delay giữa các tin nhắn (s)
            </label>
            <Input
              type="number"
              value={Math.round(delay / 1000)}
              onChange={(e) => setDelay(Math.max(0, Number(e.target.value) || 0) * 1000)}
              min={0}
              step={1}
            />

          {isScheduled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Lặp lại</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as 'none'|'daily'|'weekly'|'monthly'|'interval')}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="none">Không lặp</option>
                  <option value="daily">Hàng ngày</option>
                  <option value="weekly">Hàng tuần</option>
                  <option value="monthly">Hàng tháng</option>
                  <option value="interval">Theo khoảng giờ</option>
                </select>
                {recurrence === 'interval' && (
                  <div className="mt-2">
                    <Input
                      label="Khoảng lặp (giờ)"
                      type="number"
                      value={intervalHours}
                      onChange={(e) => setIntervalHours(Math.max(1, Number(e.target.value) || 1))}
                      min={1}
                      step={1}
                    />
                  </div>
                )}
              </div>
              <Input
                label="Số lần lặp"
                type="number"
                value={repeatCount}
                onChange={(e) => setRepeatCount(Math.max(1, Number(e.target.value) || 1))}
                min={1}
                step={1}
                disabled={recurrence === 'none'}
              />
            </div>
          )}

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
              disabled={!selectedTemplate || selectedGroups.length === 0}
            >
              {isScheduled ? 'Lên lịch gửi' : 'Gửi tin nhắn'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default GroupMessages
