import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const electronAPI = {
  // Store operations
  store: {
    get: (key: string) => ipcRenderer.invoke('store-get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store-delete', key),
    clear: () => ipcRenderer.invoke('store-clear'),
  },

  // Dialog operations
  dialog: {
    showMessageBox: (options: Electron.MessageBoxOptions) =>
      ipcRenderer.invoke('show-message-box', options),
    showSaveDialog: (options: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('show-open-dialog', options),
  },

  // App information
  app: {
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    getPath: (name: string) => ipcRenderer.invoke('get-app-path', name),
  },
  // Data file operations
  data: {
    dir: () => ipcRenderer.invoke('data-dir'),
    read: (filename: string) => ipcRenderer.invoke('data-read', filename),
    write: (filename: string, content: string) => ipcRenderer.invoke('data-write', filename, content),
    remove: (filename: string) => ipcRenderer.invoke('data-remove', filename),
  },

  // Database operations
  db: {
    // Accounts
    getAccounts: () => ipcRenderer.invoke('db-get-accounts'),
    getAccount: (id: string) => ipcRenderer.invoke('db-get-account', id),
    createAccount: (account: any) => ipcRenderer.invoke('db-create-account', account),
    updateAccount: (id: string, updates: any) => ipcRenderer.invoke('db-update-account', id, updates),
    deleteAccount: (id: string) => ipcRenderer.invoke('db-delete-account', id),

    // Friends
    getFriends: (accountId: string) => ipcRenderer.invoke('db-get-friends', accountId),
    getFriendsWithTags: (accountId: string) => ipcRenderer.invoke('db-get-friends-with-tags', accountId),
    upsertFriend: (friend: any) => ipcRenderer.invoke('db-upsert-friend', friend),
    updateFriend: (id: string, accountId: string, updates: any) => ipcRenderer.invoke('db-update-friend', id, accountId, updates),
    deleteFriend: (id: string, accountId: string) => ipcRenderer.invoke('db-delete-friend', id, accountId),

    // Friend Tags
    addFriendTag: (friendId: string, accountId: string, tag: string) => ipcRenderer.invoke('db-add-friend-tag', friendId, accountId, tag),
    removeFriendTag: (friendId: string, accountId: string, tag: string) => ipcRenderer.invoke('db-remove-friend-tag', friendId, accountId, tag),
    getFriendTags: (friendId: string, accountId: string) => ipcRenderer.invoke('db-get-friend-tags', friendId, accountId),
    getAllTags: (accountId: string) => ipcRenderer.invoke('db-get-all-tags', accountId),

    // Groups
    getGroups: (accountId: string) => ipcRenderer.invoke('db-get-groups', accountId),
    upsertGroup: (group: any) => ipcRenderer.invoke('db-upsert-group', group),
    updateGroup: (id: string, accountId: string, updates: any) => ipcRenderer.invoke('db-update-group', id, accountId, updates),
    deleteGroup: (id: string, accountId: string) => ipcRenderer.invoke('db-delete-group', id, accountId),

    // Templates
    getTemplates: () => ipcRenderer.invoke('db-get-templates'),
    createTemplate: (template: any) => ipcRenderer.invoke('db-create-template', template),
    updateTemplate: (id: string, updates: any) => ipcRenderer.invoke('db-update-template', id, updates),
    deleteTemplate: (id: string) => ipcRenderer.invoke('db-delete-template', id),

    // Message Logs
    createMessageLog: (log: any) => ipcRenderer.invoke('db-create-message-log', log),
    getMessageLogs: (accountId: string, limit?: number) => ipcRenderer.invoke('db-get-message-logs', accountId, limit),

    // Share Content
    getShareContent: () => ipcRenderer.invoke('db-get-share-content'),
    createShareContent: (content: any) => ipcRenderer.invoke('db-create-share-content', content),
    updateShareContent: (id: string, updates: any) => ipcRenderer.invoke('db-update-share-content', id, updates),
    deleteShareContent: (id: string) => ipcRenderer.invoke('db-delete-share-content', id),

    // Share Categories
    getShareCategories: () => ipcRenderer.invoke('db-get-share-categories'),
    createShareCategory: (category: any) => ipcRenderer.invoke('db-create-share-category', category),
    deleteShareCategory: (id: string) => ipcRenderer.invoke('db-delete-share-category', id),
  },
  // Zalo API operations
  zalo: {
    login: (credentials: any) => ipcRenderer.invoke('zalo-login', credentials),
    loginQRStart: () => ipcRenderer.invoke('zalo-login-qr-start'),
    loginQRCancel: () => ipcRenderer.invoke('zalo-login-qr-cancel'),
    onQREvent: (callback: (event: { type: number; data: any }) => void) => {
      const handler = (_: any, event: { type: number; data: any }) => callback(event)
      ipcRenderer.on('zalo-qr-event', handler)
      return () => ipcRenderer.removeListener('zalo-qr-event', handler)
    },
    logout: () => ipcRenderer.invoke('zalo-logout'),
    isLoggedIn: () => ipcRenderer.invoke('zalo-is-logged-in'),
    getFriends: () => ipcRenderer.invoke('zalo-get-friends'),
    getGroups: () => ipcRenderer.invoke('zalo-get-groups'),
    getGroupInfo: (groupId: string | string[]) => ipcRenderer.invoke('zalo-get-group-info', groupId),
    joinGroupLink: (link: string) => ipcRenderer.invoke('zalo-join-group-link', link),
    findUser: (phoneNumber: string) => ipcRenderer.invoke('zalo-find-user', phoneNumber),
    sendFriendRequest: (userId: string, message?: string) => ipcRenderer.invoke('zalo-send-friend-request', { userId, message }),
    addUserToGroup: (groupId: string, userIds: string[]) => ipcRenderer.invoke('zalo-add-user-to-group', { groupId, userIds }),
    testGroupsAdmin: () => ipcRenderer.invoke('zalo-test-groups-admin'),

    getAccountInfo: () => ipcRenderer.invoke('zalo-get-account-info'),
    getUserInfo: (userId: string | string[]) => ipcRenderer.invoke('zalo-get-user-info', userId),
    leaveGroup: (groupId: string, silent?: boolean) => ipcRenderer.invoke('zalo-leave-group', groupId, silent ?? false),
    getLabels: () => ipcRenderer.invoke('zalo-get-labels'),
    updateLabels: (payload: { labelData: any[]; version: number }) =>
      ipcRenderer.invoke('zalo-update-labels', payload),
    sendMessage: (payload: { threadId: string; message?: string; threadType?: 'user' | 'group'; attachments?: string[] }) => {
      try { console.log('🧪 preload.sendMessage ->', { threadId: payload.threadId, threadType: payload.threadType, msgLen: payload.message?.length || 0, att: payload.attachments?.length || 0, firstAtt: payload.attachments?.[0] }) } catch {}
      return ipcRenderer.invoke('zalo-send-message', payload)
    },
    sendGroupMessage: (payload: { groupId: string; message: string }) =>
      ipcRenderer.invoke('zalo-send-group-message', payload),
    sendLink: (payload: { threadId: string; link: string; msg?: string; threadType?: 'user' | 'group'; ttl?: number }) =>
      ipcRenderer.invoke('zalo-send-link', payload),
    sendVideo: (payload: { threadId: string; videoUrl: string; thumbnailUrl: string; msg?: string; duration?: number; width?: number; height?: number; ttl?: number; threadType?: 'user' | 'group' }) =>
      ipcRenderer.invoke('zalo-send-video', payload),
    getGroupMembersInfo: (memberIds: string[]) => ipcRenderer.invoke('zalo-get-group-members-info', memberIds),
    forwardMessage: (payload: { threadIds: string[]; message?: string; attachments?: string[]; reference?: { id: string; ts: number; logSrcType: number; fwLvl: number }; ttl?: number; threadType?: 'user'|'group' }) => {
      try { console.log('🧪 preload.forwardMessage ->', { threadType: payload.threadType, msgLen: payload.message?.length || 0, ids: payload.threadIds?.length || 0, hasRef: !!payload.reference, ttl: payload.ttl, att: payload.attachments?.length || 0, firstAtt: payload.attachments?.[0] }) } catch {}
      return ipcRenderer.invoke('zalo-forward-message', payload)
    },
  },


  // Menu events
  menu: {
    onNewAccount: (callback: () => void) => {
      ipcRenderer.on('menu-new-account', callback)
      return () => ipcRenderer.removeListener('menu-new-account', callback)
    },
    onImportData: (callback: () => void) => {
      ipcRenderer.on('menu-import-data', callback)
      return () => ipcRenderer.removeListener('menu-import-data', callback)
    },
    onExportData: (callback: () => void) => {
      ipcRenderer.on('menu-export-data', callback)
      return () => ipcRenderer.removeListener('menu-export-data', callback)
    },
    onAbout: (callback: () => void) => {
      ipcRenderer.on('menu-about', callback)
      return () => ipcRenderer.removeListener('menu-about', callback)
    },
  },

  // License operations
  license: {
    check: (key: string, forceCheck?: boolean) => ipcRenderer.invoke('license-check', key, forceCheck),
    getStored: () => ipcRenderer.invoke('license-get-stored'),
    clear: () => ipcRenderer.invoke('license-clear'),
    getHWID: () => ipcRenderer.invoke('license-get-hwid'),
  },

  // Auto-updater operations
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater-check'),
    downloadUpdate: () => ipcRenderer.invoke('updater-download'),
    installUpdate: () => ipcRenderer.invoke('updater-install'),
    getVersion: () => ipcRenderer.invoke('updater-get-version'),
    onStatus: (callback: (data: { status: string; data?: any }) => void) => {
      const handler = (_: any, data: { status: string; data?: any }) => callback(data)
      ipcRenderer.on('updater-status', handler)
      return () => ipcRenderer.removeListener('updater-status', handler)
    },
  },

  // Platform information
  platform: process.platform,

  // Node.js APIs (limited for security)
  node: {
    process: {
      platform: process.platform,
      arch: process.arch,
      versions: process.versions,
    },
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  } catch (error) {
    console.error('Failed to expose electronAPI:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = electronAPI
}

// Type definitions for the exposed API
export type ElectronAPI = typeof electronAPI
