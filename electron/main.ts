import { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeImage } from 'electron'
import { join, normalize } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs'
import Store from 'electron-store'

// Simple utility functions to replace @electron-toolkit/utils
const is = {
  dev: process.env.NODE_ENV === 'development'
}

const electronApp = {
  setAppUserModelId: (id: string) => {
    if (process.platform === 'win32') {
      app.setAppUserModelId(id)
    }
  }
}

const optimizer = {
  watchWindowShortcuts: (window: BrowserWindow) => {
    // Simple implementation for F12 DevTools toggle
    window.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12') {
        window.webContents.toggleDevTools()
      }
    })
  }
}

// Initialize electron store for persistent data
const store = new Store()

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: join(__dirname, '../../resources/icon.png'), // Add your app icon
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show()

      // Always open DevTools for debugging
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.zalomanager.app')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent navigation to external websites
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (navigationEvent, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)

    if (parsedUrl.origin !== 'http://localhost:3000' && parsedUrl.origin !== 'file://') {
      navigationEvent.preventDefault()
    }
  })
})

// IPC handlers for main process communication
ipcMain.handle('store-get', (_, key: string) => {
  return store.get(key)
})

ipcMain.handle('store-set', (_, key: string, value: any) => {
  store.set(key, value)
  return true
})

ipcMain.handle('store-delete', (_, key: string) => {
  store.delete(key)
  return true
})

ipcMain.handle('store-clear', () => {
  store.clear()
  return true
})

ipcMain.handle('show-message-box', async (_, options) => {
  if (mainWindow) {
    const result = await dialog.showMessageBox(mainWindow, options)
    return result
  }
  return null
})

ipcMain.handle('show-save-dialog', async (_, options) => {
  if (mainWindow) {
    const result = await dialog.showSaveDialog(mainWindow, options)
    return result
  }
  return null
})

ipcMain.handle('show-open-dialog', async (_, options) => {
  if (mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, options)
    return result
  }
  return null
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-app-path', (_, name: string) => {
  return app.getPath(name as any)
})


// Data directory and JSON file IPC handlers
const getDataDir = () => {
  const base = app.isPackaged ? app.getPath('userData') : process.cwd()
  const dir = join(base, 'data')
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  } catch (e) {
    console.error('Failed to ensure data dir', e)
  }
  return dir
}

ipcMain.handle('data-dir', () => {
  return getDataDir()
})

ipcMain.handle('data-read', (_event, filename: string) => {
  try {
    const file = join(getDataDir(), filename)
    if (!existsSync(file)) return null
    const content = readFileSync(file, 'utf-8')
    return content
  } catch (e) {
    console.error('data-read error:', e)
    return null
  }
})

ipcMain.handle('data-write', (_event, filename: string, content: string) => {
  try {
    const file = join(getDataDir(), filename)
    writeFileSync(file, content ?? '', 'utf-8')
    return true
  } catch (e) {
    console.error('data-write error:', e)
    return false
  }
})

ipcMain.handle('data-remove', (_event, filename: string) => {
  try {
    const file = join(getDataDir(), filename)
    if (existsSync(file)) unlinkSync(file)
    return true
  } catch (e) {
    console.error('data-remove error:', e)
    return false
  }
})
// Zalo API handlers using zca-js in main process
let Zalo: any = null
let zaloInstance: any = null
let zaloAPI: any = null

const initializeZalo = async () => {
  try {
    // Load CJS build of zca-js to be compatible with Electron main (CommonJS)
    const path = require('path')
    const zcaPath = path.join(__dirname, '../../zca-js/dist/cjs/index.cjs')
    console.log('🔎 Trying to load zca-js (CJS) from:', zcaPath)

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const zcaModule = require(zcaPath)
    Zalo = zcaModule.Zalo
    console.log('✅ zca-js CJS loaded in main process')
    return true
  } catch (error) {
    console.error('❌ Failed to load zca-js:', error)
    return false
  }
}

ipcMain.handle('zalo-login', async (_event, credentials) => {
  try {
    console.log('🔥 Main process: zalo-login called')

    if (!await initializeZalo()) {
      return { success: false, error: 'Failed to initialize Zalo library' }
    }

    zaloInstance = new Zalo({
      selfListen: true, // Bật nhận sự kiện tin nhắn của chính mình để lấy ts
      imageMetadataGetter: async (filePath: string) => {
        try {
          const img = nativeImage.createFromPath(filePath)
          const size = img.getSize()
          if (!size || !size.width || !size.height) return null
          const stat = statSync(filePath)
          return { width: size.width, height: size.height, size: stat.size }
        } catch (e) {
          console.warn('imageMetadataGetter failed:', e)
          return null
        }
      }
    })

    // Parse cookie if string
    let parsedCookie = credentials.cookie
    if (typeof credentials.cookie === 'string') {
      try {
        parsedCookie = JSON.parse(credentials.cookie)
      } catch (e) {
        return { success: false, error: 'Invalid cookie format' }
      }
    }

    console.log('🔥 Main process: Attempting Zalo login...')
    zaloAPI = await zaloInstance.login({
      cookie: parsedCookie,
      imei: credentials.imei,
      userAgent: credentials.userAgent
    })

    if (zaloAPI?.listener?.ctx) {
      console.log('✅ Main process: Zalo login successful')
      return {
        success: true,
        uid: zaloAPI.listener.ctx.uid
      }
    } else {
      return { success: false, error: 'Login failed - no valid API context' }
    }
  } catch (error) {
    console.error('🔥 Main process: Zalo login error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('zalo-logout', async () => {
  try {
    if (zaloAPI?.listener) {
      zaloAPI.listener.stop()
    }
    zaloAPI = null
    zaloInstance = null
    return { success: true }
  } catch (error) {
    console.error('Zalo logout error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('zalo-is-logged-in', () => {
  return { loggedIn: zaloAPI !== null }
})

ipcMain.handle('zalo-get-friends', async () => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }

    const friends = await zaloAPI.getAllFriends()
    return { success: true, friends }
  } catch (error) {
    console.error('Get friends error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('zalo-get-groups', async () => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }

    const groups = await zaloAPI.getAllGroups()
    return { success: true, groups }
  } catch (error) {
    console.error('Get groups error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Get group info (detail) - supports single id or batch of ids
ipcMain.handle('zalo-get-group-info', async (_event, groupOrIds: string | string[]) => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }
    const ids = Array.isArray(groupOrIds) ? groupOrIds.filter(Boolean) : [groupOrIds]
    if (!ids || ids.length === 0) {
      return { success: false, error: 'Invalid groupId(s)' }
    }

    if (typeof (zaloAPI as any).getGroupInfo === 'function') {
      const info = await (zaloAPI as any).getGroupInfo(ids)
      return { success: true, info }
    }

    return { success: false, error: 'getGroupInfo not available' }
  } catch (error) {
    console.error('Get group info error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Get group members profile info by member IDs (batch)
ipcMain.handle('zalo-get-group-members-info', async (_event, memberIds: string[]) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return { success: false, error: 'Invalid memberIds' }
    }
    if (typeof (zaloAPI as any).getGroupMembersInfo === 'function') {
      const info = await (zaloAPI as any).getGroupMembersInfo(memberIds)
      return { success: true, info }
    }
    return { success: false, error: 'getGroupMembersInfo not available' }
  } catch (error) {
    console.error('Get group members info error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})


ipcMain.handle('zalo-get-account-info', async () => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }
    const accountInfo = await zaloAPI.fetchAccountInfo()
    return { success: true, accountInfo }
  } catch (error) {
    console.error('Get account info error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Get user info (supports single or batch ids)
ipcMain.handle('zalo-get-user-info', async (_event, userOrIds: string | string[]) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    const ids = Array.isArray(userOrIds) ? userOrIds.filter(Boolean) : [userOrIds]
    if (!ids.length) return { success: false, error: 'Invalid user id(s)' }
    if (typeof (zaloAPI as any).getUserInfo === 'function') {
      const info = await (zaloAPI as any).getUserInfo(ids)
      return { success: true, info }
    }
    return { success: false, error: 'getUserInfo not available' }
  } catch (error) {
    console.error('Get user info error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})


// Join group via invite link
ipcMain.handle('zalo-join-group-link', async (_event, link: string) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    if (!link || typeof link !== 'string') return { success: false, error: 'Missing link' }
    if (typeof (zaloAPI as any).joinGroupLink !== 'function') {
      return { success: false, error: 'joinGroupLink not available' }
    }
    const info = await (zaloAPI as any).joinGroupLink(link)
    return { success: true, info }
  } catch (error: any) {
    console.error('Join group via link error:', error)
    const msg = error?.message || String(error)
    // try extract error code if present in message
    const codeMatch = String(msg).match(/code\s*[:=]\s*(\d+)/i)
    return { success: false, error: msg, code: codeMatch ? Number(codeMatch[1]) : undefined }
  }
})

// Find user by phone number
ipcMain.handle('zalo-find-user', async (_event, phoneNumber: string) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    if (!phoneNumber || typeof phoneNumber !== 'string') return { success: false, error: 'Missing phoneNumber' }
    if (typeof (zaloAPI as any).findUser !== 'function') return { success: false, error: 'findUser not available' }
    const info = await (zaloAPI as any).findUser(phoneNumber)
    return { success: true, info }
  } catch (error: any) {
    console.error('Find user error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Send friend request by userId (robust to API signature differences)
ipcMain.handle('zalo-send-friend-request', async (_event, payload: { userId: string; message?: string }) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    const { userId, message } = payload || ({} as any)
    const uid = String(userId || '').trim()
    const msg = typeof message === 'string' ? message : ''
    if (!uid) return { success: false, error: 'Missing userId' }

    const api: any = zaloAPI as any
    const tryCalls: Array<() => Promise<any>> = []

    // Primary expected signature (from zca-js): (msg, userId)
    if (typeof api.sendFriendRequest === 'function') {
      tryCalls.push(() => api.sendFriendRequest(msg, uid))
      // Some builds may accept an options object as first param
      tryCalls.push(() => api.sendFriendRequest({ msg }, uid))
      // Fallback: reversed parameters or optional message
      tryCalls.push(() => api.sendFriendRequest(uid, msg))
      tryCalls.push(() => api.sendFriendRequest(uid))
    }

    // Possible older alias
    if (api.friend?.sendRequest) {
      tryCalls.push(() => api.friend.sendRequest(uid, msg))
      tryCalls.push(() => api.friend.sendRequest({ toid: uid, msg }))
    }

    if (tryCalls.length === 0) return { success: false, error: 'sendFriendRequest not available' }

    let lastErr: any = null
    for (const call of tryCalls) {
      try {
        const res = await call()
        return { success: true, info: res }
      } catch (e: any) {
        lastErr = e
      }
    }

    const msgErr = lastErr?.message || String(lastErr)
    const code = (lastErr && typeof lastErr === 'object' && 'code' in lastErr) ? Number((lastErr as any).code) : (String(msgErr).match(/code\s*[:=]\s*(\d+)/i)?.[1] ? Number(String(msgErr).match(/code\s*[:=]\s*(\d+)/i)![1]) : undefined)
    return { success: false, error: msgErr, code }
  } catch (error: any) {
    console.error('Send friend request error:', error)
    const msg = error?.message || String(error)
    const code = (error && typeof error === 'object' && 'code' in error) ? Number(error.code) : (String(msg).match(/code\s*[:=]\s*(\d+)/i)?.[1] ? Number(String(msg).match(/code\s*[:=]\s*(\d+)/i)![1]) : undefined)
    return { success: false, error: msg, code }
  }
})

// Add users to group
ipcMain.handle('zalo-add-user-to-group', async (_event, payload: { groupId: string; userIds: string[] }) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    const { groupId, userIds } = payload || ({} as any)

    if (!groupId || typeof groupId !== 'string') {
      return { success: false, error: 'Missing groupId' }
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { success: false, error: 'Missing or empty userIds array' }
    }

    // Clean and validate user IDs
    const cleanUserIds = userIds
      .map(id => String(id || '').trim())
      .filter(Boolean)

    if (cleanUserIds.length === 0) {
      return { success: false, error: 'No valid user IDs provided' }
    }

    const api: any = zaloAPI as any

    // Strategy 1: Try addUserToGroup (requires admin/creator permission)
    if (typeof api.addUserToGroup === 'function') {
      try {
        console.log(`🔧 Trying addUserToGroup for ${cleanUserIds.length} users to group ${groupId}`)
        const result = await api.addUserToGroup(cleanUserIds, groupId)

        console.log('✅ addUserToGroup result:', {
          errorMembers: result?.errorMembers?.length || 0,
          total: cleanUserIds.length,
          error_data: result?.error_data
        })

        // Check for error code 188 (not friends) or 269 (stranger in invite list)
        const error188Users: string[] = result?.error_data?.['188'] || []
        const error269Users: string[] = result?.error_data?.['269'] || []
        const notFriendUsers = [...error188Users, ...error269Users]

        // If some users succeeded
        if (!result?.errorMembers || result.errorMembers.length < cleanUserIds.length) {
          return {
            success: true,
            errorMembers: result?.errorMembers || [],
            error_data: result?.error_data || {},
            notFriendUsers: notFriendUsers.length > 0 ? notFriendUsers : undefined
          }
        }

        // If all failed due to "not friends", return specific error
        if (notFriendUsers.length === cleanUserIds.length) {
          console.log('⚠️ All users failed because they are not friends')
          return {
            success: false,
            errorMembers: result?.errorMembers || [],
            error_data: result?.error_data || {},
            notFriendUsers,
            error: 'Cần kết bạn trước khi thêm vào nhóm'
          }
        }

        // If all failed for other reasons, try fallback
        console.log('⚠️ All users failed with addUserToGroup, trying inviteUserToGroups fallback...')
      } catch (addError: any) {
        console.log('⚠️ addUserToGroup failed:', addError?.message || String(addError))
        console.log('Trying inviteUserToGroups fallback...')
      }
    }

    // Strategy 2: Fallback to inviteUserToGroups (works for non-admin members)
    if (typeof api.inviteUserToGroups === 'function') {
      console.log(`🔧 Using inviteUserToGroups fallback for ${cleanUserIds.length} users`)

      const errorMembers: string[] = []
      const successMembers: string[] = []

      // inviteUserToGroups signature: (userId, groupId)
      // Can only invite ONE user at a time
      for (const userId of cleanUserIds) {
        try {
          const result = await api.inviteUserToGroups(userId, groupId)

          // Check if invitation was successful
          const gridMessageMap = result?.grid_message_map || {}
          const groupResult = gridMessageMap[groupId]

          if (groupResult?.error_code === 0 || groupResult?.data) {
            successMembers.push(userId)
            console.log(`✅ Invited user ${userId} successfully`)
          } else {
            errorMembers.push(userId)
            console.log(`❌ Failed to invite user ${userId}:`, groupResult?.error_message || 'Unknown error')
          }
        } catch (inviteError: any) {
          errorMembers.push(userId)
          console.log(`❌ Exception inviting user ${userId}:`, inviteError?.message || String(inviteError))
        }

        // Small delay between invitations to avoid rate limiting
        if (cleanUserIds.length > 1) {
          await new Promise(r => setTimeout(r, 300))
        }
      }

      console.log(`🎯 inviteUserToGroups result: ${successMembers.length} success, ${errorMembers.length} failed`)

      return {
        success: successMembers.length > 0,
        errorMembers: errorMembers.length > 0 ? errorMembers : undefined,
        method: 'invite' // Indicate which method was used
      }
    }

    // No method available
    return { success: false, error: 'No add/invite method available' }
  } catch (error: any) {
    console.error('Add user to group error:', error)
    const msg = error?.message || String(error)
    return { success: false, error: msg }
  }
})

// Test handler để debug groups admin
ipcMain.handle('zalo-test-groups-admin', async () => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }

    console.log('🔥 Testing groups admin status...')

    // Lấy current user ID từ context thay vì fetchAccountInfo
    const currentUserId = zaloAPI.listener?.ctx?.uid
    console.log('👤 Current user ID from context:', currentUserId)

    // Lấy thông tin tài khoản (có thể undefined)
    const accountInfo = await zaloAPI.fetchAccountInfo()
    console.log('👤 Account info:', {
      uid: accountInfo?.uid,
      displayName: accountInfo?.displayName,
      zaloName: accountInfo?.zaloName
    })

    // Lấy danh sách nhóm
    const allGroups = await zaloAPI.getAllGroups()
    const groupIds = Object.keys(allGroups.gridVerMap || {})
    console.log('📊 Total groups:', groupIds.length)

    if (groupIds.length === 0) {
      return { success: true, adminCount: 0, totalGroups: 0, message: 'No groups found' }
    }

    // Test với 10 nhóm đầu tiên
    const testGroupIds = groupIds.slice(0, 10)
    const groupInfo = await zaloAPI.getGroupInfo(testGroupIds)

    let adminCount = 0
    // Sử dụng currentUserId từ context thay vì accountInfo.uid
    const results = []

    if (groupInfo && groupInfo.gridInfoMap) {
      for (const [groupId, info] of Object.entries(groupInfo.gridInfoMap)) {
        const groupData = info as any
        const adminIds = groupData.adminIds || []
        const isAdmin = adminIds.includes(currentUserId)

        console.log(`📝 Group: ${groupData.name || 'Unknown'}`)
        console.log(`   - ID: ${groupId}`)
        console.log(`   - Admin IDs: [${adminIds.join(', ')}]`)
        console.log(`   - Current User ID: ${currentUserId}`)
        console.log(`   - Is Admin: ${isAdmin}`)
        console.log('   ---')

        results.push({
          id: groupId,
          name: groupData.name || 'Unknown',
          adminIds,
          isAdmin,
          memberCount: groupData.totalMember || 0
        })

        if (isAdmin) {
          adminCount++
        }
      }
    }

    console.log(`🎯 RESULT: Admin in ${adminCount} out of ${testGroupIds.length} tested groups`)

    return {
      success: true,
      adminCount,
      totalGroups: groupIds.length,
      testedGroups: testGroupIds.length,
      currentUserId,
      results
    }
  } catch (error) {
    console.error('Test groups admin error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Leave group
ipcMain.handle('zalo-leave-group', async (_event, groupId: string, silent: boolean = false) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    if (!groupId) return { success: false, error: 'Missing groupId' }
    if (typeof (zaloAPI as any).leaveGroup !== 'function') {
      return { success: false, error: 'leaveGroup not available' }
    }
    const res = await (zaloAPI as any).leaveGroup(groupId, silent)
    return { success: true, info: res }
  } catch (error) {
    console.error('Leave group error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('zalo-get-labels', async () => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }
    if (typeof zaloAPI.getLabels !== 'function') {
      return { success: false, error: 'getLabels not available in current zca-js version' }
    }
    const labels = await zaloAPI.getLabels()
    return { success: true, labels }
  } catch (error) {
    console.error('Get labels error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('zalo-update-labels', async (_event, payload: { labelData: any[]; version: number }) => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }
    if (typeof zaloAPI.updateLabels !== 'function') {
      return { success: false, error: 'updateLabels not available in current zca-js version' }
    }
    const result = await zaloAPI.updateLabels(payload)
    return { success: true, result }
  } catch (error) {
    console.error('Update labels error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})


// Send message to user or group (support attachments)
ipcMain.handle('zalo-send-message', async (_event, payload: { threadId: string; message?: string; threadType?: 'user' | 'group'; attachments?: Array<string | { path: string }> }) => {
  try {
    if (!zaloAPI) {
      return { success: false, error: 'Not logged in' }
    }
    let { threadId, message, threadType = 'user', attachments } = payload || ({} as any)
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0
    try { console.log('📥 ipc zalo-send-message recv', { threadId, threadType, msgLen: (message||'').length, att: hasAttachments ? attachments.length : 0, firstAtt: hasAttachments ? attachments[0] : undefined }) } catch {}
    if (!threadId || (!message && !hasAttachments)) return { success: false, error: 'Invalid params' }

    // Normalize threadId: loại bỏ ký tự không phải số, giữ nguyên base ID
    const rawThreadId = String(threadId).trim()
    threadId = rawThreadId.replace(/[^\d]/g, '')
    if (threadId !== rawThreadId) {
      console.log('🔧 Normalized threadId:', rawThreadId, '->', threadId)
    }

    const typeNum = threadType === 'group' ? 1 : 0

    // Chuẩn hóa message object theo zca-js
    const msgObj: any = typeof message === 'string' ? { msg: message } : (message || {})
    if (hasAttachments) {
      const atts = (attachments as any[])
        .map(a => typeof a === 'string' ? a : a?.path)
        .filter(Boolean)
        .map(p => normalize(String(p)))
      if (atts.length > 0) {
        msgObj.attachments = atts
        console.log('🖼️ zalo-send-message attachments:', atts)
      }
    }

    // Thử nhiều chữ ký hàm để tương thích các phiên bản zca-js khác nhau
    const tryCalls: Array<() => Promise<void>> = []

    if (typeof (zaloAPI as any).sendMessage === 'function') {
      // Ưu tiên gọi với object (hỗ trợ attachments)
      tryCalls.push(() => (zaloAPI as any).sendMessage(msgObj, threadId, typeNum))
      // Fallback chuỗi chỉ áp dụng khi không có attachments
      if (!msgObj.attachments) {
        tryCalls.push(() => (zaloAPI as any).sendMessage(threadId, message, threadType))
        tryCalls.push(() => (zaloAPI as any).sendMessage(threadId, message))
      }
    }
    // Ensure image metadata getter exists for legacy sessions (login before upgrade)
    try {
      const ctx = (zaloAPI as any)?.listener?.ctx
      if (ctx && ctx.options && !ctx.options.imageMetadataGetter) {
        ctx.options.imageMetadataGetter = async (filePath: string) => {
          try {
            const img = nativeImage.createFromPath(filePath)
            const size = img.getSize()
            if (!size || !size.width || !size.height) return null
            const st = statSync(filePath)
            return { width: size.width, height: size.height, size: st.size }
          } catch (e) {
            console.warn('imageMetadataGetter (late) failed:', e)
            return null
          }
        }
        console.log('🧩 injected imageMetadataGetter into existing session')
      }
    } catch {}

    // Các API chuyên biệt không hỗ trợ attachments -> chỉ fallback khi không có attachments
    if (!msgObj.attachments) {
      if (threadType === 'group') {
        if (typeof (zaloAPI as any).sendGroupMessage === 'function') {
          tryCalls.push(() => (zaloAPI as any).sendGroupMessage(threadId, message))
        }
      } else {
        if (typeof (zaloAPI as any).sendUserMessage === 'function') {
          tryCalls.push(() => (zaloAPI as any).sendUserMessage(threadId, message))
        }
      }
    }

    let ok = false
    let lastError: any = null
    for (const call of tryCalls) {
      try {
        await call()
        ok = true
        break
      } catch (e) {
        lastError = e
        const errMsg = e instanceof Error ? e.message : String(e)
        console.warn('⚠️ sendMessage attempt failed:', errMsg)
        continue
      }
    }

    if (!ok) {
      const errorMessage = lastError instanceof Error ? lastError.message : (lastError ? String(lastError) : 'Send API not available in current zca-js version')
      console.error('❌ All sendMessage attempts failed:', errorMessage)

      // Nếu có attachments và tất cả đều thất bại, thử lại không có attachments
      if (msgObj.attachments && msgObj.attachments.length > 0) {
        console.log('🔄 Retrying without attachments...')
        try {
          const msgWithoutAtt = { msg: typeof message === 'string' ? message : (msgObj.msg || '') }
          await (zaloAPI as any).sendMessage(msgWithoutAtt, threadId, typeNum)
          console.log('✅ Sent successfully without attachments')
          return { success: true, warning: 'Sent without attachments due to API limitation' }
        } catch (retryError) {
          console.error('❌ Retry without attachments also failed:', retryError)
        }
      }

      return { success: false, error: errorMessage }
    }

    return { success: true }
  } catch (error) {
    console.error('Send message error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('zalo-send-group-message', async (_event, payload: { groupId: string; message: string }) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    const { groupId, message } = payload || {}
    if (!groupId || !message) return { success: false, error: 'Invalid params' }

    if (typeof zaloAPI.sendGroupMessage === 'function') {
      await zaloAPI.sendGroupMessage(groupId, message)
      return { success: true }
    }
    if (typeof zaloAPI.sendMessage === 'function') {
      await zaloAPI.sendMessage(groupId, message, 1)
      return { success: true }
    }

    return { success: false, error: 'sendGroupMessage not available' }
  } catch (error) {
    console.error('Send group message error:', error)
  }
})

// Send link to user or group
ipcMain.handle('zalo-send-link', async (_event, payload: { threadId: string; link: string; msg?: string; threadType?: 'user' | 'group'; ttl?: number }) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    const { threadId, link, msg, threadType = 'user', ttl } = payload || ({} as any)
    if (!threadId || !link) return { success: false, error: 'Invalid params' }

    const typeNum = threadType === 'group' ? 1 : 0 // ThreadType.Group : ThreadType.User
    if (typeof (zaloAPI as any).sendLink === 'function') {
      await (zaloAPI as any).sendLink({ link, msg, ttl }, threadId, typeNum)
      return { success: true }
    }
    return { success: false, error: 'sendLink not available' }
  } catch (error) {
    console.error('Send link error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Forward message to multiple threads (user/group)
ipcMain.handle('zalo-forward-message', async (_event, payload: { threadIds: string[]; message?: string; attachments?: string[]; reference?: { id: string; ts: number; logSrcType: number; fwLvl: number }; ttl?: number; threadType?: 'user' | 'group' }) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    const { threadIds, message, reference, ttl, threadType = 'user', attachments } = payload || ({} as any)
    const hasAtt = Array.isArray(attachments) && attachments.length > 0
    if (!Array.isArray(threadIds) || threadIds.length === 0 || (!message && !hasAtt)) {
      return { success: false, error: 'Invalid params' }
    }
    const typeNum = threadType === 'group' ? 1 : 0

    // Nếu có attachments: Thực hiện chiến lược "send 1 gốc -> forward reference"
    // 1) Gửi sendMessage kèm file cho thread đầu tiên để tạo tin gốc (có msgId)
    // 2) Dùng forwardMessage với reference (id, ts, fwLvl, logSrcType) tới các thread còn lại
    // Lưu ý: API sendMessage của zca-js trả về msgId (không có ts), ta dùng Date.now() làm ts tạm
    if (hasAtt) {
      try { console.log('📥 ipc zalo-forward-message (ref-forward strategy)', { type: threadType, ids: threadIds.length, msgLen: (message||'').length, ttl, att: attachments.length, firstAtt: attachments[0] }) } catch {}
      if (typeof (zaloAPI as any).sendMessage !== 'function' || typeof (zaloAPI as any).forwardMessage !== 'function') {
        return { success: false, error: 'Missing sendMessage/forwardMessage API for reference-based forward' }
      }

      const firstId = threadIds[0]
      const restIds = threadIds.slice(1)


        // Đăng ký buffer listener TRƯỚC khi gửi để không bỏ lỡ event tự thân
        const _listener = (zaloAPI as any)?.listener
        const _buf: any[] = []
        let _bufActive = false
        const _onMsgBuf = (m: any) => {
          try {
            if (!_bufActive) return
            const tid = String(m?.threadId || '')
            const isSelf = !!m?.isSelf

            if (isSelf && tid === String(firstId)) _buf.push(m)
          } catch {}
        }
        const _onOldBuf = (msgs: any[]) => {
          try {
            if (!_bufActive || !Array.isArray(msgs)) return
            for (const m of msgs) {
              const tid = String(m?.threadId || '')
              const isSelf = !!m?.isSelf
              if (isSelf && tid === String(firstId)) _buf.push(m)
            }
          } catch {}
        }
        if (_listener && typeof _listener.on === 'function') {
          _bufActive = true
          _listener.on('message', _onMsgBuf)
          _listener.on('old_messages', _onOldBuf)
        }
        // Cleanup buffer listeners when done
        const _cleanupBuf = () => {
          try {
            if (_listener) {
              if (typeof _listener.off === 'function') {
                _listener.off('message', _onMsgBuf)
                _listener.off('old_messages', _onOldBuf)
              } else if (typeof _listener.removeListener === 'function') {
                _listener.removeListener('message', _onMsgBuf)
                _listener.removeListener('old_messages', _onOldBuf)
              }
            }
          } catch {}
          _bufActive = false
        }
        // Tiện ích: tìm nhanh trong buffer theo msgId/realMsgId
        const _findInBuf = (candidateId: string) => {
          for (let i = _buf.length - 1; i >= 0; i--) {
            const m = _buf[i]
            const mid = String(m?.data?.msgId || '')
            const rid = String(m?.data?.realMsgId || '')
            if (mid === String(candidateId) || (!!rid && rid === String(candidateId))) {
              const tsVal = Number(m?.data?.ts)
              const idFinal = rid || mid
              return { id: idFinal || null, ts: Number.isFinite(tsVal) ? tsVal : null }
            }
          }
          return null
        }



      try {
        // B1. Gửi tin gốc tới người đầu tiên
        const res = await (zaloAPI as any).sendMessage({ msg: message || '', attachments, ttl }, firstId, typeNum)
        // Chọn msgId từ phần attachment (ưu tiên ảnh/file thực tế)
        const attachmentMsgId = Array.isArray(res?.attachment) && res.attachment.length > 0 ? res.attachment[0]?.msgId : undefined
        const textMsgId = res?.message?.msgId
        const selectedMsgId = attachmentMsgId || textMsgId
        if (!selectedMsgId) {
          _cleanupBuf()
          return { success: false, error: 'Cannot obtain msgId from original message to build reference' }
        }

        // B2. Forward reference tới phần còn lại (nếu có)
        if (restIds.length > 0) {
          const fwdPayload: any = { message: message || '' }
          if (typeof ttl === 'number') fwdPayload.ttl = ttl

          // Tìm nhanh trong buffer trước
          let refSource: 'buf' | 'listener' | 'fallback' = 'fallback'
          let ref = _findInBuf(String(selectedMsgId)) || null
          if (ref && ref.id && ref.ts) refSource = 'buf'
          if (!ref) ref = { id: String(selectedMsgId), ts: Date.now() }

          // Nếu chưa có trong buffer, tiếp tục nghe + yêu cầu old_messages để lấy ts/realMsgId
          if (refSource !== 'buf') {
            // Cố gắng lấy reference CHÍNH XÁC (id ưu tiên realMsgId, ts) của tin gốc thông qua listener (yêu cầu selfListen=true)
            const getSelfReference = (candidateMsgId: string, threadId: string, typeNum: number, timeoutMs = 6000): Promise<{ id: string | null; ts: number | null }> => {
              return new Promise((resolve) => {
                try {
                  const listener = (zaloAPI as any)?.listener
                  if (!listener || typeof listener.on !== 'function') return resolve({ id: null, ts: null })

                  let done = false
                  const cleanup = () => {
                    try {
                      if (typeof listener.off === 'function') {
                        listener.off('message', onMessage)
                        listener.off('old_messages', onOldMessages)
                        listener.off('delivered_messages', onDelivered)
                      } else if (typeof listener.removeListener === 'function') {
                        listener.removeListener('message', onMessage)
                        listener.removeListener('old_messages', onOldMessages)
                        listener.removeListener('delivered_messages', onDelivered)
                      }
                    } catch {}
                  }

                  const finish = (val: { id: string | null; ts: number | null }) => {
                    if (done) return
                    done = true
                    try { clearTimeout(timer) } catch {}
                    cleanup()
                    resolve(val)
                  }

                  const matchAndFinish = (m: any) => {
                    const mid = String(m?.data?.msgId || '')
                    const rid = String(m?.data?.realMsgId || '')
                    const tid = String(m?.threadId || '')
                    const isSelf = !!m?.isSelf
                    if (isSelf && tid === String(threadId) && (mid === String(candidateMsgId) || (!!rid && rid === String(candidateMsgId)))) {
                      const tsVal = Number(m?.data?.ts)
                      const idFinal = rid || mid
                      return finish({ id: idFinal || null, ts: Number.isFinite(tsVal) ? tsVal : null })
                    }
                  }

                  const onMessage = (m: any) => { try { if (!done) matchAndFinish(m) } catch {} }
                  const onOldMessages = (msgs: any[]) => {
                    try {
                      if (done || !Array.isArray(msgs)) return
                      for (const m of msgs) {
                        if (done) break
                        matchAndFinish(m)
                      }
                    } catch {}
                  }
                  const onDelivered = (msgs: any[]) => {
                    try {
                      if (done || !Array.isArray(msgs)) return
                      for (const d of msgs) {
                        if (done) break
                        const mid = String(d?.data?.msgId || '')
                        const rid = String(d?.data?.realMsgId || '')
                        const tid = String(d?.threadId || '')
                        if (tid === String(threadId) && (mid === String(candidateMsgId) || (!!rid && rid === String(candidateMsgId)))) {
                          const tsVal = Number(d?.data?.mSTs)
                          const idFinal = rid || mid
                          return finish({ id: idFinal || null, ts: Number.isFinite(tsVal) ? tsVal : null })
                        }
                      }
                    } catch {}
                  }

                  listener.on('message', onMessage)
                  listener.on('old_messages', onOldMessages)
                  listener.on('delivered_messages', onDelivered)

                  // Chủ động yêu cầu server trả về old_messages để đảm bảo có ts/realMsgId, ưu tiên quanh lastMsgId
                  try { listener.requestOldMessages(typeNum === 1 ? 1 : 0, String(candidateMsgId)) } catch {}

                  const timer = setTimeout(() => finish({ id: null, ts: null }), timeoutMs)
                } catch {
                  return resolve({ id: null, ts: null })
                }
              })
            }

            try {
              const found = await getSelfReference(String(selectedMsgId), String(firstId), typeNum, 6000)
              if (found?.id && found?.ts) {
                ref = { id: String(found.id), ts: found.ts }
                refSource = 'listener'
              }
            } catch {}
          }

          // Xây reference: ưu tiên realMsgId nếu có, và ts từ server; nếu không có, fallback msgId và Date.now()
          fwdPayload.reference = { id: ref.id!, ts: ref.ts!, logSrcType: 1, fwLvl: 1 }
          _cleanupBuf()
          try { console.log('🔗 build reference for forward', { ref: fwdPayload.reference, source: refSource }) } catch {}

          if (refSource === 'fallback') {
            try { console.warn('⚠️ reference fallback, switch to sendMessage for restIds') } catch {}
            const results: any[] = []
            for (const toId of restIds) {
              try {
                const r = await (zaloAPI as any).sendMessage({ msg: message || '', attachments, ttl }, toId, typeNum)
                results.push({ toId, ok: true, r })
              } catch (err) {
                results.push({ toId, ok: false, err: err instanceof Error ? err.message : String(err) })
              }
            }
            return { success: true, result: { original: res, mode: 'fallback_send', results } }
          }

          const fwdRes = await (zaloAPI as any).forwardMessage(fwdPayload, restIds, typeNum)
          return { success: true, result: { original: res, mode: 'forward', forward: fwdRes, reference: fwdPayload.reference } }
        }

        return { success: true, result: { original: res } }
      } catch (e: any) {
        console.error('ref-forward error:', e)
        return { success: false, error: e instanceof Error ? e.message : String(e) }
      }
    }

    if (typeof (zaloAPI as any).forwardMessage !== 'function') {
      return { success: false, error: 'forwardMessage not available' }
    }

    const fwdPayload: any = { message }
    if (typeof ttl === 'number') fwdPayload.ttl = ttl
    if (reference && reference.id && reference.ts) fwdPayload.reference = reference

    try { console.log('📥 ipc zalo-forward-message recv', { type: threadType, ids: threadIds.length, msgLen: (message||'').length, hasRef: !!reference, ttl }) } catch {}

    const res = await (zaloAPI as any).forwardMessage(fwdPayload, threadIds, typeNum)
    return { success: true, result: res }
  } catch (error) {
    console.error('Forward message error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})


// Send video to user or group (videoUrl must be a public URL)
ipcMain.handle('zalo-send-video', async (_event, payload: { threadId: string; videoUrl: string; thumbnailUrl: string; msg?: string; duration?: number; width?: number; height?: number; ttl?: number; threadType?: 'user' | 'group' }) => {
  try {
    if (!zaloAPI) return { success: false, error: 'Not logged in' }
    const { threadId, videoUrl, thumbnailUrl, msg, duration, width, height, ttl, threadType = 'user' } = payload || ({} as any)
    if (!threadId || !videoUrl || !thumbnailUrl) return { success: false, error: 'Invalid params' }

    const typeNum = threadType === 'group' ? 1 : 0
    if (typeof (zaloAPI as any).sendVideo === 'function') {
      await (zaloAPI as any).sendVideo({ msg, videoUrl, thumbnailUrl, duration, width, height, ttl }, threadId, typeNum)
      return { success: true }
    }
    return { success: false, error: 'sendVideo not available' }
  } catch (error) {
    console.error('Send video error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})


// Handle app protocol for deep linking (optional)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('zalo-manager', process.execPath, [
      join(__dirname, '../..')
    ])
  }
} else {
  app.setAsDefaultProtocolClient('zalo-manager')
}

// Create application menu
const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Account',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-account')
          }
        },
        { type: 'separator' },
        {
          label: 'Import Data',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow?.webContents.send('menu-import-data')
          }
        },
        {
          label: 'Export Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.send('menu-export-data')
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Zalo Manager',
          click: () => {
            mainWindow?.webContents.send('menu-about')
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/your-repo/zalo-manager')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createMenu()
})
