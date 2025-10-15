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
  // Zalo API operations
  zalo: {
    login: (credentials: any) => ipcRenderer.invoke('zalo-login', credentials),
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
