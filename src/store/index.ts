import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  ZaloAccount,
  ZaloFriend,
  ZaloGroup,
  MessageTemplate,
  AppConfig,
  AppNotification,
  BackgroundTask
} from '@/types'

// Storage: persist to JSON files via Electron IPC; fallback to localStorage in web
const fileStorage = createJSONStorage(() => {
  const api = (typeof window !== 'undefined' ? (window as any).electronAPI : undefined)
  if (!api || !api.data) {
    // fallback for non-Electron contexts
    return localStorage
  }
  return {
    getItem: (name: string) => api.data.read(`${name}.json`),
    setItem: (name: string, value: string) => api.data.write(`${name}.json`, value),
    removeItem: (name: string) => api.data.remove(`${name}.json`),
  } as any
})

// Account Store
interface AccountState {
  accounts: ZaloAccount[]
  activeAccount: ZaloAccount | null
  addAccount: (account: Omit<ZaloAccount, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateAccount: (id: string, updates: Partial<ZaloAccount>) => void
  deleteAccount: (id: string) => void
  setActiveAccount: (account: ZaloAccount | null) => void
  getAccountById: (id: string) => ZaloAccount | undefined
}

export const useAccountStore = create<AccountState>()(
  devtools(
    persist(
      immer((set, get) => ({
        accounts: [],
        activeAccount: null,

        addAccount: (accountData) => set((state) => {
          const newAccount: ZaloAccount = {
            ...accountData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          state.accounts.push(newAccount)
        }),

        updateAccount: (id, updates) => set((state) => {
          const index = state.accounts.findIndex(acc => acc.id === id)
          if (index !== -1) {
            state.accounts[index] = {
              ...state.accounts[index],
              ...updates,
              updatedAt: new Date(),
            }
            // Update active account if it's the one being updated
            if (state.activeAccount?.id === id) {
              state.activeAccount = state.accounts[index]
            }
          }
        }),

        deleteAccount: (id) => set((state) => {
          state.accounts = state.accounts.filter(acc => acc.id !== id)
          if (state.activeAccount?.id === id) {
            state.activeAccount = null
          }
        }),

        setActiveAccount: (account) => set((state) => {
          state.activeAccount = account
        }),

        getAccountById: (id) => {
          return get().accounts.find(acc => acc.id === id)
        },
      })),
      {
        name: 'zalo-accounts',
        storage: fileStorage,
        partialize: (state) => ({
          accounts: state.accounts,
          activeAccount: state.activeAccount,
        }),
      }
    ),
    { name: 'AccountStore' }
  )
)

// Friends Store
interface FriendsState {
  friends: ZaloFriend[]
  addFriend: (friend: Omit<ZaloFriend, 'addedAt'>) => void
  setFriends: (friends: ZaloFriend[]) => void
  updateFriend: (id: string, updates: Partial<ZaloFriend>) => void
  deleteFriend: (id: string) => void
  addFriendTag: (id: string, tag: string) => void
  removeFriendTag: (id: string, tag: string) => void
  getFriendsByTag: (tag: string) => ZaloFriend[]
  searchFriends: (query: string) => ZaloFriend[]
}

export const useFriendsStore = create<FriendsState>()(
  devtools(
    persist(
      immer((set, get) => ({
        friends: [],

        addFriend: (friendData) => set((state) => {
          const id = (friendData as any).id
          const index = id ? state.friends.findIndex(f => f.id === id) : -1
          if (index !== -1) {
            // Upsert: cập nhật bạn bè cũ theo id (giữ addedAt, giữ tags nếu không truyền)
            state.friends[index] = {
              ...state.friends[index],
              ...friendData,
              tags: friendData?.tags ?? state.friends[index].tags,
              addedAt: state.friends[index].addedAt,
            }
          } else {
            const newFriend: ZaloFriend = {
              ...friendData,
              id: id ?? crypto.randomUUID(),
              addedAt: new Date(),
              tags: friendData?.tags ?? [],
            }
            state.friends.push(newFriend)
          }
        }),


        setFriends: (friends) => set((state) => {
          state.friends = friends.map((f) => ({
            ...f,
            tags: f.tags ?? [],
            addedAt: f.addedAt ?? new Date(),
          }))
        }),

        updateFriend: (id, updates) => set((state) => {
          const index = state.friends.findIndex(friend => friend.id === id)
          if (index !== -1) {
            state.friends[index] = { ...state.friends[index], ...updates }
          }
        }),

        deleteFriend: (id) => set((state) => {
          state.friends = state.friends.filter(friend => friend.id !== id)
        }),

        addFriendTag: (id, tag) => set((state) => {
          const friend = state.friends.find(f => f.id === id)
          if (friend && !friend.tags.includes(tag)) {
            friend.tags.push(tag)
          }
        }),

        removeFriendTag: (id, tag) => set((state) => {
          const friend = state.friends.find(f => f.id === id)
          if (friend) {
            friend.tags = friend.tags.filter(t => t !== tag)
          }
        }),

        getFriendsByTag: (tag) => {
          return get().friends.filter(friend => friend.tags.includes(tag))
        },

        searchFriends: (query) => {
          const lowercaseQuery = query.toLowerCase()
          return get().friends.filter(friend =>
            friend.name.toLowerCase().includes(lowercaseQuery) ||
            friend.displayName.toLowerCase().includes(lowercaseQuery) ||
            friend.phone?.includes(query)
          )
        },
      })),
      {
        name: 'zalo-friends',
        storage: fileStorage,
      }
    ),
    { name: 'FriendsStore' }
  )
)

// Groups Store
interface GroupsState {
  groups: ZaloGroup[]
  addGroup: (group: Omit<ZaloGroup, 'joinedAt'>) => void
  setGroups: (groups: ZaloGroup[]) => void
  updateGroup: (id: string, updates: Partial<ZaloGroup>) => void
  deleteGroup: (id: string) => void
  searchGroups: (query: string) => ZaloGroup[]
}

export const useGroupsStore = create<GroupsState>()(
  devtools(
    persist(
      immer((set, get) => ({
        groups: [],

        addGroup: (groupData) => set((state) => {
          const id = (groupData as any).id
          const index = id ? state.groups.findIndex(g => g.id === id) : -1
          if (index !== -1) {
            state.groups[index] = {
              ...state.groups[index],
              ...groupData,
              joinedAt: state.groups[index].joinedAt,
            }
          } else {
            const newGroup: ZaloGroup = {
              ...groupData,
              id: id ?? crypto.randomUUID(),
              joinedAt: new Date(),
            }
            state.groups.push(newGroup)
          }
        }),

        updateGroup: (id, updates) => set((state) => {
          const index = state.groups.findIndex(group => group.id === id)
          if (index !== -1) {
            state.groups[index] = { ...state.groups[index], ...updates }
          }
        }),

        deleteGroup: (id) => set((state) => {
          state.groups = state.groups.filter(group => group.id !== id)
        }),

        setGroups: (groups) => set((state) => {
          state.groups = groups.map(g => ({
            ...g,
            joinedAt: g.joinedAt ?? new Date(),
          }))
        }),

        searchGroups: (query) => {
          const lowercaseQuery = query.toLowerCase()
          return get().groups.filter(group =>
            group.name.toLowerCase().includes(lowercaseQuery) ||
            group.description?.toLowerCase().includes(lowercaseQuery)
          )
        },
      })),
      {
        name: 'zalo-groups',
        storage: fileStorage,
      }
    ),
    { name: 'GroupsStore' }
  )
)

// Templates Store
interface TemplatesState {
  templates: MessageTemplate[]
  addTemplate: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTemplate: (id: string, updates: Partial<MessageTemplate>) => void
  deleteTemplate: (id: string) => void
  getTemplatesByType: (type: 'personal' | 'group') => MessageTemplate[]
}

export const useTemplateStore = create<TemplatesState>()(
  devtools(
    persist(
      immer((set, get) => ({
        templates: [],

        addTemplate: (templateData) => set((state) => {
          const newTemplate: MessageTemplate = {
            ...templateData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          state.templates.push(newTemplate)
        }),

        updateTemplate: (id, updates) => set((state) => {
          const index = state.templates.findIndex(template => template.id === id)
          if (index !== -1) {
            state.templates[index] = {
              ...state.templates[index],
              ...updates,
              updatedAt: new Date(),
            }
          }
        }),

        deleteTemplate: (id) => set((state) => {
          state.templates = state.templates.filter(template => template.id !== id)
        }),

        getTemplatesByType: (type) => {
          return get().templates.filter(template => template.type === type)
        },
      })),
      {
        name: 'zalo-templates',
        storage: fileStorage,
      }
    ),
    { name: 'TemplatesStore' }
  )
)

// App Store for global state
interface AppState {
  config: AppConfig
  notifications: AppNotification[]
  tasks: BackgroundTask[]
  updateConfig: (updates: Partial<AppConfig>) => void
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt'>) => void
  removeNotification: (id: string) => void
  addTask: (task: Omit<BackgroundTask, 'id'>) => void
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void
  removeTask: (id: string) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      immer((set, get) => ({
        config: {
          theme: 'system',
          language: 'vi',
          autoSave: true,
          notifications: true,
          messageDelay: 30000,
          maxRetries: 3,
          backupEnabled: true,
          backupInterval: 24,
        },
        notifications: [],
        tasks: [],

        updateConfig: (updates) => set((state) => {
          state.config = { ...state.config, ...updates }
        }),

        addNotification: (notificationData) => set((state) => {
          const newNotification: AppNotification = {
            ...notificationData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
          }
          state.notifications.push(newNotification)
        }),

        removeNotification: (id) => set((state) => {
          state.notifications = state.notifications.filter(notif => notif.id !== id)
        }),

        addTask: (taskData) => set((state) => {
          const newTask: BackgroundTask = {
            ...taskData,
            id: crypto.randomUUID(),
          }
          state.tasks.push(newTask)
        }),

        updateTask: (id, updates) => set((state) => {
          const index = state.tasks.findIndex(task => task.id === id)
          if (index !== -1) {
            state.tasks[index] = { ...state.tasks[index], ...updates }
          }
        }),

        removeTask: (id) => set((state) => {
          state.tasks = state.tasks.filter(task => task.id !== id)
        }),
      })),
      {
        name: 'zalo-app',
        storage: fileStorage,
        partialize: (state) => ({
          config: state.config,
        }),
      }
    ),
    { name: 'AppStore' }
  )
)
