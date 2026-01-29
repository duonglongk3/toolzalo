// Zalo API Service using Electron IPC to communicate with main process
import type { ZaloCredentials, ZaloFriend, ZaloGroup } from '@/types'

// Get electronAPI from window
const getElectronAPI = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI
  }
  return null
}

class ZaloService {
  private readonly electronAPI: any = null
  private loggedIn = false
  private currentUserId: string | null = null

  constructor() {
    this.electronAPI = getElectronAPI()
  }

  async login(credentials: ZaloCredentials): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) {
        console.error('🔥 Electron Zalo API not available')
        return false
      }

      const result = await this.electronAPI.zalo.login(credentials)
      this.loggedIn = !!result?.success

      // Lưu current user ID để xác định admin
      if (result?.success && result?.uid) {
        this.currentUserId = result.uid
        console.log('🔥 Current user ID from login result:', this.currentUserId)
      }

      return this.loggedIn
    } catch (error) {
      console.error('🔥 Zalo login error:', error)
      return false
    }
  }

  async loginQR(): Promise<any> {
    try {
      if (!this.electronAPI?.zalo) {
        throw new Error('Electron Zalo API not available')
      }

      // QR login would need special handling in main process
      throw new Error('QR login not implemented yet')
    } catch (error) {
      console.error('Zalo QR login error:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.electronAPI?.zalo) {
        await this.electronAPI.zalo.logout()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      this.loggedIn = false
      this.currentUserId = null // Reset current user ID
    }
  }

  isLoggedIn(): boolean {
    return this.loggedIn
  }

  getCurrentUserId(): string | null {
    return this.currentUserId
  }

  async refreshLoginState(): Promise<boolean> {
    try {
      const state = await this.electronAPI?.zalo?.isLoggedIn?.()
      this.loggedIn = !!state?.loggedIn
      return this.loggedIn
    } catch (e) {
      console.error('🔥 refreshLoginState error:', e)
      this.loggedIn = false
      return false
    }
  }

  // Friend management
  async getAllFriends(): Promise<ZaloFriend[]> {
    try {
      if (!this.electronAPI?.zalo) {
        throw new Error('Electron Zalo API not available')
      }

      const result = await this.electronAPI.zalo.getFriends()
      if (!result.success) {
        throw new Error(result.error || 'Failed to get friends')
      }

      return result.friends.map((friend: any) => ({
        id: friend.userId || friend.id,
        name: friend.name || friend.displayName,
        displayName: friend.displayName || friend.name,
        phone: friend.phoneNumber,
        avatar: friend.avatar,
        status: 'unknown' as const,
        tags: [],
        addedAt: new Date()
      }))
    } catch (error) {
      console.error('Get friends error:', error)
      return []
    }
  }

  async addFriend(phoneNumber: string, message: string = ''): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const phone = (phoneNumber || '').trim()
      if (!phone) return false
      const found = await this.electronAPI.zalo.findUser(phone)
      const info = found?.info || found
      const data = info?.data || info
      const uid = data?.uid || data?.userId || data?.data?.uid || data?.data?.userId || (Array.isArray(data?.data) ? data?.data?.[0]?.userId : undefined)
      if (!uid) {
        console.warn('findUser did not return uid for phone:', phone)
        return false
      }
      
      // Lấy tên người dùng từ kết quả findUser
      const displayName = data?.display_name || data?.displayName || data?.zalo_name || data?.zaloName || ''
      const zaloName = data?.zalo_name || data?.zaloName || displayName || ''
      
      // Thay thế các placeholder trong message
      let finalMessage = message || ''
      if (finalMessage) {
        finalMessage = finalMessage
          .replace(/\{name\}/gi, displayName || zaloName || uid)
          .replace(/\{displayName\}/gi, displayName || uid)
          .replace(/\{zaloName\}/gi, zaloName || uid)
          .replace(/\{userId\}/gi, uid)
          .replace(/\{phone\}/gi, phone)
      }
      
      // API signature: sendFriendRequest(userId, message)
      const res = await this.electronAPI.zalo.sendFriendRequest(uid, finalMessage)
      return !!res?.success
    } catch (error) {
      console.error('Add friend error:', error)
      return false
    }
  }

  async findUser(phoneNumber: string): Promise<{ userId?: string; raw?: any }> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const res = await this.electronAPI.zalo.findUser(phoneNumber)
      const info = res?.info || res
      const data = info?.data || info
      const userId = data?.uid || data?.userId || (Array.isArray(data?.data) ? data?.data?.[0]?.userId : undefined)
      return { userId, raw: info }
    } catch (error) {
      console.error('findUser error:', error)
      return { raw: null }
    }
  }

  async sendFriendRequest(message: string, userId: string, userInfo?: { displayName?: string; zaloName?: string; phone?: string }): Promise<{ success: boolean; code?: number; error?: string }> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      
      // Thay thế các placeholder trong message nếu có
      let finalMessage = message || ''
      if (finalMessage && userInfo) {
        const displayName = userInfo.displayName || userInfo.zaloName || ''
        const zaloName = userInfo.zaloName || userInfo.displayName || ''
        finalMessage = finalMessage
          .replace(/\{name\}/gi, displayName || zaloName || userId)
          .replace(/\{displayName\}/gi, displayName || userId)
          .replace(/\{zaloName\}/gi, zaloName || userId)
          .replace(/\{userId\}/gi, userId)
          .replace(/\{phone\}/gi, userInfo.phone || '')
      }
      
      // Electron API expects (userId, message) - userId first, message second
      const res = await this.electronAPI.zalo.sendFriendRequest(userId, finalMessage)
      if (res?.success) return { success: true }
      return { success: false, code: res?.code, error: res?.error }
    } catch (error: any) {
      const msg = error?.message || String(error)
      const codeMatch = String(msg).match(/code\s*[:=]\s*(\d+)/i)
      return { success: false, code: codeMatch ? Number(codeMatch[1]) : undefined, error: msg }
    }
  }

  async addFriendsBulkAdvanced(
    phones: string[],
    userIds: string[],
    delayMs: number = 800,
    message: string = '',
    onProgress?: (p: { phase: 'resolve' | 'send'; index: number; total: number; sent: number; already: number; failed: number; resolved: number; target?: string; code?: number; status?: 'sent'|'already'|'failed' }) => void
  ): Promise<{ sent: number; already: number; failed: number; resolved: number; details: Array<{ target: string; status: 'sent'|'already'|'failed'; code?: number; error?: string }> }> {
    const details: Array<{ target: string; status: 'sent'|'already'|'failed'; code?: number; error?: string }> = []
    // Map userId -> userInfo để lưu thông tin tên
    const userInfoMap: Map<string, { displayName?: string; zaloName?: string; phone?: string }> = new Map()
    
    // Chuẩn hóa userId: chỉ để số, loại bỏ ký tự không hợp lệ
    const ids = new Set<string>((userIds || []).map(u => String(u || '').replace(/[^\d]/g, '').trim()).filter(Boolean))

    // Resolve phones -> userIds và lưu thông tin tên
    let resolved = 0
    const totalResolve = (phones || []).filter(p => (p||'').trim()).length
    let resolveIndex = 0
    for (const raw of (phones || [])) {
      const phone = (raw || '').trim(); if (!phone) continue
      const { userId, raw: rawInfo } = await this.findUser(phone)
      if (userId) {
        ids.add(userId)
        resolved++
        // Lưu thông tin tên để dùng cho placeholder replacement
        const data = rawInfo?.data || rawInfo
        const displayName = data?.display_name || data?.displayName || data?.zalo_name || data?.zaloName || ''
        const zaloName = data?.zalo_name || data?.zaloName || displayName || ''
        userInfoMap.set(userId, { displayName, zaloName, phone })
      } else {
        details.push({ target: phone, status: 'failed', error: 'not_found' })
      }
      resolveIndex++
      onProgress?.({ phase: 'resolve', index: resolveIndex, total: totalResolve, sent: 0, already: 0, failed: 0, resolved, target: phone })
      if (delayMs > 0) await new Promise(r => setTimeout(r, Math.max(0, Math.min(600000, delayMs))))
    }

    let sent = 0, already = 0, failed = 0
    const idList = Array.from(ids)
    const totalSend = idList.length
    let sendIndex = 0
    for (const uid of idList) {
      // Truyền userInfo để thay thế placeholder trong message
      const userInfo = userInfoMap.get(uid)
      const r = await this.sendFriendRequest(message, uid, userInfo)
      if (r.success) { details.push({ target: uid, status: 'sent' }); sent++ }
      else if (r.code === 225 || r.code === 222) { details.push({ target: uid, status: 'already', code: r.code }); already++ }
      else { details.push({ target: uid, status: 'failed', code: r.code, error: r.error }); failed++ }
      sendIndex++
      const status = r.success ? 'sent' : ((r.code === 225 || r.code === 222) ? 'already' : 'failed')
      onProgress?.({ phase: 'send', index: sendIndex, total: totalSend, sent, already, failed, resolved, target: uid, code: r.code, status })
      if (delayMs > 0) await new Promise(r => setTimeout(r, Math.max(0, Math.min(600000, delayMs))))
    }

    return { sent, already, failed, resolved, details }
  }

  async addFriendsBulk(phoneNumbers: string[]): Promise<{ success: number; failed: number }> {
    // Backward-compat: only phones, use advanced flow with default delay
    const res = await this.addFriendsBulkAdvanced(phoneNumbers, [], 800)
    return { success: res.sent + res.already, failed: res.failed }
  }

  // Group management
  async getAllGroups(): Promise<ZaloGroup[]> {
    try {
      if (!this.electronAPI?.zalo) {
        throw new Error('Electron Zalo API not available')
      }

      const result = await this.electronAPI.zalo.getGroups()
      if (!result.success) {
        throw new Error(result.error || 'Failed to get groups')
      }

      const groups: ZaloGroup[] = []
      const verMap = result?.groups?.gridVerMap || {}
      for (const [groupId] of Object.entries(verMap)) {
        groups.push({
          id: groupId,
          // Không gán placeholder tên để tránh lưu vào store
          name: '',
          description: '',
          memberCount: 0,
          isAdmin: false,
          avatar: '',
          joinedAt: new Date(),
          type: 'private',
        })
      }

      return groups
    } catch (error) {
      console.error('Get groups error:', error)
      return []
    }
  }




  async getAccountInfo(): Promise<any> {
    try {
      if (!this.electronAPI?.zalo) {
        throw new Error('Electron Zalo API not available')
      }

      const result = await this.electronAPI.zalo.getAccountInfo()
      if (!result.success) {
        throw new Error(result.error || 'Failed to get account info')
      }

      return result.accountInfo
    } catch (error) {
      console.error('Get account info error:', error)
      return null
    }
  }
  // Labels (convlabel)
  async getLabels(): Promise<{ labelData: any[]; version: number; lastUpdateTime: number } | null> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const result = await this.electronAPI.zalo.getLabels()
      if (!result?.success) {
        console.error('getLabels error:', result?.error)
        return null
      }
      return result.labels
    } catch (error) {
      console.error('getLabels exception:', error)
      return null
    }
  }

  async updateLabels(payload: { labelData: any[]; version: number }): Promise<{ labelData: any[]; version: number; lastUpdateTime: number } | null> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const result = await this.electronAPI.zalo.updateLabels(payload)
      if (!result?.success) {
        console.error('updateLabels error:', result?.error)
        return null
      }
      return result.result
    } catch (error) {
      console.error('updateLabels exception:', error)
      return null
    }
  }

  // Helpers to assign/unassign a friend (conversation id) to an existing label by text
  async addFriendToLabel(friendId: string, labelText: string): Promise<boolean> {
    const labels = await this.getLabels()
    if (!labels) return false
    const target = labels.labelData.find((l: any) => l.text === labelText)
    if (!target) {
      console.warn('Label not found:', labelText)
      return false
    }
    if (!target.conversations.includes(friendId)) {
      target.conversations.push(friendId)
    }
    const updated = await this.updateLabels({ labelData: labels.labelData, version: labels.version })
    return !!updated
  }

  async removeFriendFromLabel(friendId: string, labelText: string): Promise<boolean> {
    const labels = await this.getLabels()
    if (!labels) return false
    const target = labels.labelData.find((l: any) => l.text === labelText)
    if (!target) return true
    target.conversations = target.conversations.filter((id: string) => id !== friendId)
    const updated = await this.updateLabels({ labelData: labels.labelData, version: labels.version })
    return !!updated
  }


  // Simplified methods for compatibility
  async joinGroup(groupLink: string): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const link = (groupLink || '').trim()
      if (!link) return false
      const res = await this.electronAPI.zalo.joinGroupLink(link)
      return !!res?.success
    } catch (error) {
      console.error('joinGroup exception:', error)
      return false
    }
  }

  async joinGroups(links: string[], delayMs: number = 200): Promise<{ joined: string[]; already: string[]; pending: string[]; failed: Array<{ link: string; error?: string | number }> }> {
    const joined: string[] = []
    const already: string[] = []
    const pending: string[] = []
    const failed: Array<{ link: string; error?: string | number }> = []
    if (!Array.isArray(links) || links.length === 0) return { joined, already, pending, failed }

    // Clamp delay to safe range [0..10000] ms
    const safeDelay = Math.max(0, Math.min(10000, Number.isFinite(delayMs as any) ? Number(delayMs) : 200))

    for (const raw of links) {
      const link = (raw || '').trim()
      if (!link) continue
      try {
        const res = await this.electronAPI?.zalo?.joinGroupLink?.(link)
        if (res?.success) {
          joined.push(link)
        } else {
          const code = res?.code
          const err = res?.error
          if (code === 178 || String(err || '').toLowerCase().includes('178')) {
            // already a member
            already.push(link)
          } else if (code === 240 || String(err || '').toLowerCase().includes('240')) {
            // membership requires approval
            pending.push(link)
          } else {
            failed.push({ link, error: code ?? err })
          }
        }
      } catch (e: any) {
        const msg = e?.message || String(e)
        failed.push({ link, error: msg })
      }
      if (safeDelay > 0) {
        await new Promise(r => setTimeout(r, safeDelay))
      }
    }
    return { joined, already, pending, failed }
  }

  async leaveGroup(groupId: string, silent: boolean = false): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      if (!groupId) return false
      const result = await this.electronAPI.zalo.leaveGroup(groupId, silent)
      if (!result?.success) {
        console.error('leaveGroup error:', result?.error)
        return false
      }
      return true
    } catch (error) {
      console.error('leaveGroup exception:', error)
      return false
    }
  }

  async sendMessage(threadId: string, message: string, threadType: 'user' | 'group' = 'user', attachments?: string[]): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const attCount = Array.isArray(attachments) ? attachments.length : 0
      try {
        console.log('🧪 renderer sendMessage ->', { threadId, threadType, messageLen: (message||'').length, attachments: attCount, firstAtt: attCount ? attachments![0] : undefined })
      } catch {}
      const result = await this.electronAPI.zalo.sendMessage({ threadId, message, threadType, attachments })
      if (!result?.success) {
        console.error('sendMessage error:', result?.error)
        return false
      }
      try {
        console.log('✅ renderer sendMessage ok:', { success: result.success, code: result.code, att: (result as any)?.attachment?.length })
      } catch {}
      return true
    } catch (error) {
      console.error('sendMessage exception:', error)
      return false
    }
  }

  async sendGroupMessage(groupId: string, message: string): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const result = await this.electronAPI.zalo.sendGroupMessage({ groupId, message })
      if (!result?.success) {
        console.error('sendGroupMessage error:', result?.error)
        return false
      }
      return true
    } catch (error) {
      console.error('sendGroupMessage exception:', error)
      return false
    }
  }

  async sendLink(threadId: string, link: string, msg?: string, threadType: 'user' | 'group' = 'user', ttl?: number): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const result = await this.electronAPI.zalo.sendLink({ threadId, link, msg, threadType, ttl })
      if (!result?.success) {
        console.error('sendLink error:', result?.error)
        return false
      }
      return true
    } catch (error) {
      console.error('sendLink exception:', error)
      return false
    }
  }

  async sendVideo(
    threadId: string,
    videoUrl: string,
    thumbnailUrl: string,
    opts?: { msg?: string; duration?: number; width?: number; height?: number; ttl?: number },
    threadType: 'user' | 'group' = 'user'
  ): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const payload = { threadId, videoUrl, thumbnailUrl, msg: opts?.msg, duration: opts?.duration, width: opts?.width, height: opts?.height, ttl: opts?.ttl, threadType }
      const result = await this.electronAPI.zalo.sendVideo(payload as any)
      if (!result?.success) {
        console.error('sendVideo error:', result?.error)
        return false
      }
      return true
    } catch (error) {
      console.error('sendVideo exception:', error)
      return false
    }
  }

  async forwardMessage(
    payload: { message: string; ttl?: number; reference?: { id: string; ts: number; logSrcType: number; fwLvl: number }; attachments?: string[] },
    threadIds: string[],
    threadType: 'user' | 'group' = 'user'
  ): Promise<boolean> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      const attCount = Array.isArray(payload?.attachments) ? payload.attachments.length : 0
      try {
        const firstAtt = Array.isArray(payload?.attachments) && payload.attachments.length > 0 ? payload.attachments[0] : undefined
        console.log('🧪 renderer forwardMessage ->', { ids: threadIds?.length || 0, threadType, messageLen: (payload?.message || '').length, attachments: attCount, firstAtt })
      } catch {}
      const res = await this.electronAPI.zalo.forwardMessage({ ...payload, threadIds, threadType })
      if (!res?.success) {
        console.error('forwardMessage error:', res?.error)
        return false
      }
      return true
    } catch (error) {
      console.error('forwardMessage exception:', error)
      return false
    }
  }


  async sendMessagesBulk(targets: Array<{ threadId: string; threadType: 'user' | 'group' }>, message: string, delay: number = 1000): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0
    for (const t of targets) {
      const ok = await this.sendMessage(t.threadId, message, t.threadType)
      if (ok) success++; else failed++
      if (delay > 0) await new Promise(r => setTimeout(r, delay))
    }
    return { success, failed }
  }


  // Get members of a group using getGroupInfo (to read memVerList) + getGroupMembersInfo (to resolve profiles)
  async getGroupMembers(groupId: string): Promise<Array<{ id: string; displayName: string; zaloName?: string; avatar?: string }>> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      if (!groupId) return []

      // Step 1: fetch group info to get member version list (IDs)
      const giRes = await this.electronAPI.zalo.getGroupInfo(groupId)
      if (!giRes?.success) {
        console.error('getGroupMembers/getGroupInfo error:', giRes?.error)
        return []
      }
      const info = giRes.info
      let gi: any | undefined
      if (info?.gridInfoMap) {
        gi = info.gridInfoMap[groupId] || Object.values(info.gridInfoMap)[0]
      }
      const memberIds: string[] = Array.isArray(gi?.memVerList) ? gi.memVerList : []
      if (memberIds.length === 0) return []

      // Step 2: batch resolve member profiles
      const CHUNK = 100
      const profiles: Record<string, any> = {}
      for (let i = 0; i < memberIds.length; i += CHUNK) {
        const chunk = memberIds.slice(i, i + CHUNK)
        const res = await this.electronAPI.zalo.getGroupMembersInfo(chunk)
        if (res?.success && res.info?.profiles) {
          Object.assign(profiles, res.info.profiles)
        }
      }

      // Step 3: batch resolve phone numbers via getUserInfo
      const baseIds = Array.from(new Set(memberIds.map((id: string) => id.split('_')[0]).filter(Boolean)))
      const phoneMap: Record<string, string | undefined> = {}
      for (let i = 0; i < baseIds.length; i += CHUNK) {
        const chunk = baseIds.slice(i, i + CHUNK)
        const r = await this.electronAPI.zalo.getUserInfo(chunk)
        const changed = r?.success ? (r.info?.changed_profiles || {}) : {}
        for (const [k, u] of Object.entries<any>(changed)) {
          const base = k.split('_')[0]
          if (base) phoneMap[base] = u?.phoneNumber
        }
      }

      // Map to simple array for UI consumption
      const out: Array<{ id: string; displayName: string; zaloName?: string; avatar?: string; phoneNumber?: string }> = []
      for (const [id, p] of Object.entries<any>(profiles)) {
        if (!p) continue
        const base = id.split('_')[0]
        out.push({ id: base || id, displayName: p.displayName || p.zaloName || base || id, zaloName: p.zaloName, avatar: p.avatar, phoneNumber: base ? phoneMap[base] : undefined })
      }
      return out
    } catch (error) {
      console.error('getGroupMembers exception:', error)
      return []
    }
  }

  // Add users to group with batch processing and delay
  async addUserToGroup(groupId: string, userIds: string[]): Promise<{ success: boolean; errorMembers?: string[]; error?: string }> {
    try {
      if (!this.electronAPI?.zalo) throw new Error('Electron Zalo API not available')
      if (!groupId || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'Invalid parameters' }
      }

      // If only 1-3 users, add directly without delay
      if (userIds.length <= 3) {
        const result = await this.electronAPI.zalo.addUserToGroup(groupId, userIds)
        if (!result?.success) {
          return { success: false, error: result?.error || 'Failed to add users to group', errorMembers: result?.errorMembers }
        }
        return { success: true, errorMembers: result.errorMembers }
      }

      // For many users, process in batches with delay
      const batchSize = 5 // Add max 5 users per batch
      const delayBetweenBatches = 1000 // 1 second delay between batches
      const allErrorMembers: string[] = []
      let hasSuccess = false

      console.log(`🔄 Adding ${userIds.length} users to group in batches of ${batchSize}...`)

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(userIds.length / batchSize)

        console.log(`📦 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} users`)

        try {
          const result = await this.electronAPI.zalo.addUserToGroup(groupId, batch)

          if (result?.success) {
            hasSuccess = true
            if (result.errorMembers && result.errorMembers.length > 0) {
              allErrorMembers.push(...result.errorMembers)
              console.log(`⚠️ Batch ${batchNumber}: ${batch.length - result.errorMembers.length}/${batch.length} users added successfully`)
            } else {
              console.log(`✅ Batch ${batchNumber}: All ${batch.length} users added successfully`)
            }
          } else {
            console.log(`❌ Batch ${batchNumber}: Failed - ${result?.error || 'Unknown error'}`)
            allErrorMembers.push(...batch) // All users in this batch failed
          }
        } catch (error) {
          console.error(`❌ Batch ${batchNumber} exception:`, error)
          allErrorMembers.push(...batch) // All users in this batch failed
        }

        // Add delay between batches (except for the last batch)
        if (i + batchSize < userIds.length) {
          console.log(`⏳ Waiting ${delayBetweenBatches}ms before next batch...`)
          await new Promise(r => setTimeout(r, delayBetweenBatches))
        }
      }

      const successCount = userIds.length - allErrorMembers.length
      console.log(`🎯 Final result: ${successCount}/${userIds.length} users added successfully`)

      return {
        success: hasSuccess,
        errorMembers: allErrorMembers.length > 0 ? allErrorMembers : undefined
      }
    } catch (error) {
      console.error('addUserToGroup exception:', error)
      return { success: false, error: String(error) }
    }
  }

  async addUsersToGroupByPhones(groupId: string, phoneNumbers: string[]): Promise<{ success: boolean; added: number; failed: number; details: Array<{ phone: string; userId?: string; status: 'added' | 'failed'; error?: string }> }> {
    const details: Array<{ phone: string; userId?: string; status: 'added' | 'failed'; error?: string }> = []
    let added = 0
    let failed = 0

    try {
      if (!groupId || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return { success: false, added: 0, failed: 0, details: [] }
      }

      // Step 1: Resolve phone numbers to user IDs with progressive delay
      const userIds: string[] = []
      const totalPhones = phoneNumbers.length

      console.log(`🔍 Resolving ${totalPhones} phone numbers to user IDs...`)

      for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i]
        const cleanPhone = (phone || '').trim()

        if (!cleanPhone) {
          details.push({ phone: cleanPhone, status: 'failed', error: 'Empty phone number' })
          failed++
          continue
        }

        console.log(`📞 Resolving ${i + 1}/${totalPhones}: ${cleanPhone}`)

        try {
          const { userId } = await this.findUser(cleanPhone)
          if (userId) {
            userIds.push(userId)
            details.push({ phone: cleanPhone, userId, status: 'added' })
            console.log(`✅ Found user: ${cleanPhone} → ${userId}`)
          } else {
            details.push({ phone: cleanPhone, status: 'failed', error: 'User not found' })
            failed++
            console.log(`❌ User not found: ${cleanPhone}`)
          }
        } catch (error) {
          details.push({ phone: cleanPhone, status: 'failed', error: String(error) })
          failed++
          console.log(`❌ Error resolving ${cleanPhone}:`, error)
        }

        // Progressive delay: longer delay for more phones to avoid rate limiting
        const baseDelay = 300
        const progressiveDelay = totalPhones > 10 ? Math.min(1000, baseDelay + (i * 50)) : baseDelay

        if (i < phoneNumbers.length - 1) { // Don't delay after the last phone
          console.log(`⏳ Waiting ${progressiveDelay}ms before next phone...`)
          await new Promise(r => setTimeout(r, progressiveDelay))
        }
      }

      // Step 2: Add users to group if we have valid user IDs
      if (userIds.length > 0) {
        const result = await this.addUserToGroup(groupId, userIds)
        if (result.success) {
          added = userIds.length - (result.errorMembers?.length || 0)
          // Update details for failed additions
          if (result.errorMembers && result.errorMembers.length > 0) {
            for (const detail of details) {
              if (detail.userId && result.errorMembers.includes(detail.userId)) {
                detail.status = 'failed'
                detail.error = 'Failed to add to group'
                failed++
                added--
              }
            }
          }
        } else {
          // All additions failed
          for (const detail of details) {
            if (detail.status === 'added') {
              detail.status = 'failed'
              detail.error = result.error || 'Failed to add to group'
              failed++
            }
          }
          added = 0
        }
      }

      return { success: added > 0, added, failed, details }
    } catch (error) {
      console.error('addUsersToGroupByPhones exception:', error)
      return { success: false, added: 0, failed: phoneNumbers.length, details: phoneNumbers.map(phone => ({ phone, status: 'failed' as const, error: String(error) })) }
    }
  }

  // Message listener (would need special handling in Electron)
  startMessageListener(_onMessage: (message: any) => void): void {
    console.warn('startMessageListener not implemented yet')
  }

  stopMessageListener(): void {
    console.warn('stopMessageListener not implemented yet')
  }

}

// Export singleton instance
export const zaloService = new ZaloService()


// Helper: fetch single group info via IPC (outside class to avoid TS parser edge cases)
export async function fetchGroupInfo(groupId: string): Promise<Partial<ZaloGroup> | null> {
  try {
    const api = getElectronAPI()
    if (!api?.zalo) throw new Error('Electron Zalo API not available')
    if (!groupId) return null
    const result = await api.zalo.getGroupInfo(groupId)
    if (!result?.success) {
      console.error('fetchGroupInfo error:', result?.error)
      return null
    }
    const info = result.info
    const map: any = info?.gridInfoMap || {}
    const keys = Object.keys(map)
    const w = String(groupId)
    const wBase = w.split('_')[0]
    let key: string | null = null
    if (map[w]) key = w
    else if (map[wBase]) key = wBase
    else key = keys.find(k => k === w || k === wBase || k.split('_')[0] === w || k.split('_')[0] === wBase) || keys.find(k => k.includes(w) || k.includes(wBase)) || null
    const gi: any = key ? map[key] : undefined
    if (!gi) return null

    // Xác định isAdmin dựa trên adminIds HOẶC creatorId
    const currentUserId = zaloService.getCurrentUserId()
    const adminIds: string[] = gi.adminIds || []
    const creatorId: string = gi.creatorId || ''

    // Bạn là admin nếu:
    // 1. Có trong danh sách adminIds, HOẶC
    // 2. Là người tạo nhóm (creatorId)
    const isAdminByIds = currentUserId ? adminIds.includes(currentUserId) : false
    const isCreator = currentUserId ? creatorId === currentUserId : false
    const isAdmin = isAdminByIds || isCreator

    // Debug log chi tiết
    if (isAdmin || adminIds.length > 0) {
      console.log(`🔥 Group ${groupId}: ${gi.name || 'Unknown'}`)
      console.log(`   - currentUserId: "${currentUserId}"`)
      console.log(`   - creatorId: "${creatorId}"`)
      console.log(`   - adminIds: [${adminIds.map(id => `"${id}"`).join(', ')}]`)
      console.log(`   - isCreator: ${isCreator}`)
      console.log(`   - isAdminByIds: ${isAdminByIds}`)
      console.log(`   - isAdmin (final): ${isAdmin}`)
    }

    return {
      name: gi.name || undefined,
      description: gi.desc || undefined,
      avatar: gi.avt || gi.fullAvt || undefined,
      memberCount: gi.totalMember || gi.membersCount || undefined,
      isAdmin,
    }
  } catch (error) {
    console.error('fetchGroupInfo exception:', error)
    return null
  }
}

// Attach helper to instance for backward compatibility usage: zaloService.getGroupInfo(...)
;(zaloService as any).getGroupInfo = fetchGroupInfo


// Helper: fetch multiple groups info via batch IPC
export async function fetchGroupInfos(groupIds: string[]): Promise<Record<string, Partial<ZaloGroup>>> {
  const out: Record<string, Partial<ZaloGroup>> = {}
  if (!groupIds || groupIds.length === 0) return out
  try {
    const api = getElectronAPI()
    if (!api?.zalo) throw new Error('Electron Zalo API not available')
    const ids = Array.from(new Set(groupIds.filter(Boolean)))
    if (ids.length === 0) return out

    const result = await api.zalo.getGroupInfo(ids)
    if (!result?.success) {
      console.error('fetchGroupInfos error:', result?.error)
      return out
    }
    const rawMap = (result as any)?.info?.gridInfoMap || {}
    const serverKeys = Object.keys(rawMap)

    // Chua khp kha server -> id gc: md sf trp k (id, id_base)
    const findKeyFor = (wanted: string): string | null => {
      if (!wanted) return null
      const w = String(wanted)
      const wBase = w.split('_')[0]
      // 1) exact
      if (rawMap[w]) return w
      // 2) exact base
      if (rawMap[wBase]) return wBase
      // 3) server key startsWith/endsWith wanted or base
      const k1 = serverKeys.find(k => k === w || k === wBase || k.split('_')[0] === w || k.split('_')[0] === wBase)
      if (k1) return k1
      // 4) loose include as last resort
      const k2 = serverKeys.find(k => k.includes(w) || k.includes(wBase))
      return k2 || null
    }

    // Lấy current user ID để xác định admin
    const currentUserId = zaloService.getCurrentUserId()

    for (const id of ids) {
      const key = findKeyFor(String(id))
      const gi: any = key ? rawMap[key] : undefined
      if (!gi) continue

      // Xác định isAdmin dựa trên adminIds
      const adminIds: string[] = gi.adminIds || []
      const isAdmin = currentUserId ? adminIds.includes(currentUserId) : false

      console.log(`🔥 Batch Group ${id}: currentUserId=${currentUserId}, adminIds=[${adminIds.join(',')}], isAdmin=${isAdmin}`)

      out[id] = {
        name: gi.name || undefined,
        description: gi.desc || undefined,
        avatar: gi.avt || gi.fullAvt || undefined,
        memberCount: gi.totalMember || gi.membersCount || undefined,
        isAdmin,
      }
    }
  } catch (error) {
    console.error('fetchGroupInfos exception:', error)
  }
  return out
}

// Attach helper to instance for batch usage
;(zaloService as any).getGroupInfos = fetchGroupInfos
