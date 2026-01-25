import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  ZaloAccount,
  ZaloFriend,
  ZaloGroup,
  MessageTemplate
} from '@/types'
import type {
  DbAccount,
  DbFriend,
  DbGroup,
  DbMessageTemplate
} from '@/database/models'

// Helper to get electron API
const getElectronAPI = () => {
  return typeof window !== 'undefined' ? (window as any).electronAPI : null
}

// Storage cho activeAccountId - persist qua electron-store
const activeAccountStorage = createJSONStorage(() => {
  const api = getElectronAPI()
  if (!api?.store) {
    return localStorage
  }
  return {
    getItem: async (name: string) => {
      const value = await api.store.get(name)
      return value ?? null
    },
    setItem: async (name: string, value: string) => {
      await api.store.set(name, value)
    },
    removeItem: async (name: string) => {
      await api.store.delete(name)
    },
  } as any
})

// Convert database models to app types
const dbAccountToZaloAccount = (dbAccount: DbAccount): ZaloAccount => ({
  id: dbAccount.id,
  name: dbAccount.name,
  phone: dbAccount.phone,
  imei: dbAccount.imei,
  cookie: dbAccount.cookie,
  userAgent: dbAccount.user_agent,
  status: dbAccount.status,
  lastLogin: dbAccount.last_login ? new Date(dbAccount.last_login) : undefined,
  createdAt: new Date(dbAccount.created_at),
  updatedAt: new Date(dbAccount.updated_at)
})

const dbFriendToZaloFriend = (dbFriend: DbFriend, tags: string[] = []): ZaloFriend => ({
  id: dbFriend.id,
  name: dbFriend.name,
  displayName: dbFriend.display_name,
  phone: dbFriend.phone || undefined,
  avatar: dbFriend.avatar || undefined,
  status: dbFriend.status,
  tags: tags,
  addedAt: new Date(dbFriend.added_at),
  lastInteraction: dbFriend.last_interaction ? new Date(dbFriend.last_interaction) : undefined
})

const dbGroupToZaloGroup = (dbGroup: DbGroup): ZaloGroup => ({
  id: dbGroup.id,
  name: dbGroup.name,
  description: dbGroup.description || undefined,
  avatar: dbGroup.avatar || undefined,
  memberCount: dbGroup.member_count,
  isAdmin: dbGroup.is_admin === 1,
  joinedAt: new Date(dbGroup.joined_at),
  lastActivity: dbGroup.last_activity ? new Date(dbGroup.last_activity) : undefined,
  type: dbGroup.type
})

const dbTemplateToMessageTemplate = (dbTemplate: DbMessageTemplate): MessageTemplate => ({
  id: dbTemplate.id,
  name: dbTemplate.name,
  content: dbTemplate.content,
  type: dbTemplate.type,
  category: dbTemplate.category || undefined,
  variables: JSON.parse(dbTemplate.variables || '[]'),
  media: JSON.parse(dbTemplate.media || '[]'),
  createdAt: new Date(dbTemplate.created_at),
  updatedAt: new Date(dbTemplate.updated_at)
})

// Account Store with Database
interface AccountState {
  accounts: ZaloAccount[]
  activeAccount: ZaloAccount | null
  activeAccountId: string | null  // Persist ID để restore khi restart app
  loading: boolean
  
  loadAccounts: () => Promise<void>
  addAccount: (account: Omit<ZaloAccount, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateAccount: (id: string, updates: Partial<ZaloAccount>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  setActiveAccount: (account: ZaloAccount | null) => void
  getAccountById: (id: string) => ZaloAccount | undefined
  restoreActiveAccount: () => void  // Khôi phục activeAccount từ ID đã lưu
}

export const useAccountStore = create<AccountState>()(
  devtools(
    persist(
      immer((set, get) => ({
        accounts: [],
        activeAccount: null,
        activeAccountId: null,
        loading: false,

        loadAccounts: async () => {
          const api = getElectronAPI()
          if (!api?.db) return

          set({ loading: true })
          try {
            const dbAccounts = await api.db.getAccounts()
            const accounts = dbAccounts.map(dbAccountToZaloAccount)
            set({ accounts, loading: false })
            
            // Khôi phục activeAccount từ ID đã lưu
            const { activeAccountId } = get()
            if (activeAccountId && !get().activeAccount) {
              const savedAccount = accounts.find(acc => acc.id === activeAccountId)
              if (savedAccount) {
                console.log('🔄 Restoring active account:', savedAccount.name)
                set({ activeAccount: savedAccount })
              }
            }
          } catch (error) {
            console.error('Failed to load accounts:', error)
            set({ loading: false })
          }
        },

      addAccount: async (accountData) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const newAccount = {
          id: crypto.randomUUID(),
          ...accountData,
          user_agent: accountData.userAgent,
          last_login: accountData.lastLogin?.toISOString() || null
        }

        try {
          const dbAccount = await api.db.createAccount(newAccount)
          set((state) => {
            state.accounts.push(dbAccountToZaloAccount(dbAccount))
          })
        } catch (error) {
          console.error('Failed to add account:', error)
          throw error
        }
      },

      updateAccount: async (id, updates) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const dbUpdates: any = {}
        if (updates.name) dbUpdates.name = updates.name
        if (updates.phone) dbUpdates.phone = updates.phone
        if (updates.imei) dbUpdates.imei = updates.imei
        if (updates.cookie) dbUpdates.cookie = updates.cookie
        if (updates.userAgent) dbUpdates.user_agent = updates.userAgent
        if (updates.status) dbUpdates.status = updates.status
        if (updates.lastLogin) dbUpdates.last_login = updates.lastLogin.toISOString()

        try {
          const dbAccount = await api.db.updateAccount(id, dbUpdates)
          if (dbAccount) {
            set((state) => {
              const index = state.accounts.findIndex(acc => acc.id === id)
              if (index !== -1) {
                state.accounts[index] = dbAccountToZaloAccount(dbAccount)
                if (state.activeAccount?.id === id) {
                  state.activeAccount = state.accounts[index]
                }
              }
            })
          }
        } catch (error) {
          console.error('Failed to update account:', error)
          throw error
        }
      },

      deleteAccount: async (id) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          await api.db.deleteAccount(id)
          set((state) => {
            state.accounts = state.accounts.filter(acc => acc.id !== id)
            if (state.activeAccount?.id === id) {
              state.activeAccount = null
            }
          })
        } catch (error) {
          console.error('Failed to delete account:', error)
          throw error
        }
      },

      setActiveAccount: (account) => set({ 
        activeAccount: account,
        activeAccountId: account?.id || null  // Lưu ID để persist
      }),

      getAccountById: (id) => {
        return get().accounts.find(acc => acc.id === id)
      },

      restoreActiveAccount: () => {
        const { activeAccountId, accounts } = get()
        if (activeAccountId && accounts.length > 0) {
          const savedAccount = accounts.find(acc => acc.id === activeAccountId)
          if (savedAccount) {
            set({ activeAccount: savedAccount })
          }
        }
      },
    })),
    {
      name: 'zalo-active-account',
      storage: activeAccountStorage,
      partialize: (state) => ({
        activeAccountId: state.activeAccountId,  // Chỉ persist ID, không persist toàn bộ account
      }),
    }
  ),
    { name: 'AccountStore' }
  )
)

// Friends Store with Database
interface FriendsState {
  friends: ZaloFriend[]
  loading: boolean
  currentAccountId: string | null
  
  loadFriends: (accountId: string) => Promise<void>
  addFriend: (accountId: string, friend: Omit<ZaloFriend, 'addedAt'>) => Promise<void>
  setFriends: (accountId: string, friends: ZaloFriend[]) => Promise<void>
  updateFriend: (accountId: string, id: string, updates: Partial<ZaloFriend>) => Promise<void>
  deleteFriend: (accountId: string, id: string) => Promise<void>
  addFriendTag: (accountId: string, id: string, tag: string) => Promise<void>
  removeFriendTag: (accountId: string, id: string, tag: string) => Promise<void>
  getFriendsByTag: (tag: string) => ZaloFriend[]
  searchFriends: (query: string) => ZaloFriend[]
}

export const useFriendsStore = create<FriendsState>()(
  devtools(
    immer((set, get) => ({
      friends: [],
      loading: false,
      currentAccountId: null,

      loadFriends: async (accountId: string) => {
        const api = getElectronAPI()
        if (!api?.db) return

        set({ loading: true, currentAccountId: accountId })
        try {
          const dbFriendsWithTags = await api.db.getFriendsWithTags(accountId)
          const friends = dbFriendsWithTags.map((f: any) => 
            dbFriendToZaloFriend(f, f.tags || [])
          )
          set({ friends, loading: false })
        } catch (error) {
          console.error('Failed to load friends:', error)
          set({ loading: false })
        }
      },

      addFriend: async (accountId, friendData) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const newFriend = {
          id: (friendData as any).id || crypto.randomUUID(),
          account_id: accountId,
          name: friendData.name,
          display_name: friendData.displayName,
          phone: friendData.phone || null,
          avatar: friendData.avatar || null,
          status: friendData.status,
          last_interaction: friendData.lastInteraction?.toISOString() || null
        }

        try {
          const dbFriend = await api.db.upsertFriend(newFriend)
          
          // Add tags if any
          if (friendData.tags && friendData.tags.length > 0) {
            for (const tag of friendData.tags) {
              await api.db.addFriendTag(newFriend.id, accountId, tag)
            }
          }

          set((state) => {
            const index = state.friends.findIndex(f => f.id === newFriend.id)
            const friend = dbFriendToZaloFriend(dbFriend, friendData.tags || [])
            if (index !== -1) {
              state.friends[index] = friend
            } else {
              state.friends.push(friend)
            }
          })
        } catch (error) {
          console.error('Failed to add friend:', error)
          throw error
        }
      },

      setFriends: async (accountId, friends) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          for (const friend of friends) {
            await get().addFriend(accountId, friend)
          }
        } catch (error) {
          console.error('Failed to set friends:', error)
        }
      },

      updateFriend: async (accountId, id, updates) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const dbUpdates: any = {}
        if (updates.name) dbUpdates.name = updates.name
        if (updates.displayName) dbUpdates.display_name = updates.displayName
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone
        if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar
        if (updates.status) dbUpdates.status = updates.status
        if (updates.lastInteraction) dbUpdates.last_interaction = updates.lastInteraction.toISOString()

        try {
          await api.db.updateFriend(id, accountId, dbUpdates)
          await get().loadFriends(accountId)
        } catch (error) {
          console.error('Failed to update friend:', error)
          throw error
        }
      },

      deleteFriend: async (accountId, id) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          await api.db.deleteFriend(id, accountId)
          set((state) => {
            state.friends = state.friends.filter(f => f.id !== id)
          })
        } catch (error) {
          console.error('Failed to delete friend:', error)
          throw error
        }
      },

      addFriendTag: async (accountId, id, tag) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          await api.db.addFriendTag(id, accountId, tag)
          set((state) => {
            const friend = state.friends.find(f => f.id === id)
            if (friend && !friend.tags.includes(tag)) {
              friend.tags.push(tag)
            }
          })
        } catch (error) {
          console.error('Failed to add friend tag:', error)
          throw error
        }
      },

      removeFriendTag: async (accountId, id, tag) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          await api.db.removeFriendTag(id, accountId, tag)
          set((state) => {
            const friend = state.friends.find(f => f.id === id)
            if (friend) {
              friend.tags = friend.tags.filter(t => t !== tag)
            }
          })
        } catch (error) {
          console.error('Failed to remove friend tag:', error)
          throw error
        }
      },

      getFriendsByTag: (tag) => {
        return get().friends.filter(f => f.tags.includes(tag))
      },

      searchFriends: (query) => {
        const q = query.toLowerCase()
        return get().friends.filter(f =>
          f.name.toLowerCase().includes(q) ||
          f.displayName.toLowerCase().includes(q) ||
          f.phone?.includes(query)
        )
      },
    })),
    { name: 'FriendsStore' }
  )
)

// Groups Store with Database
interface GroupsState {
  groups: ZaloGroup[]
  loading: boolean
  currentAccountId: string | null

  loadGroups: (accountId: string) => Promise<void>
  addGroup: (accountId: string, group: Omit<ZaloGroup, 'joinedAt'>) => Promise<void>
  setGroups: (accountId: string, groups: ZaloGroup[]) => Promise<void>
  updateGroup: (accountId: string, id: string, updates: Partial<ZaloGroup>) => Promise<void>
  deleteGroup: (accountId: string, id: string) => Promise<void>
  getGroupById: (id: string) => ZaloGroup | undefined
  searchGroups: (query: string) => ZaloGroup[]
}

export const useGroupsStore = create<GroupsState>()(
  devtools(
    immer((set, get) => ({
      groups: [],
      loading: false,
      currentAccountId: null,

      loadGroups: async (accountId: string) => {
        const api = getElectronAPI()
        if (!api?.db) return

        set({ loading: true, currentAccountId: accountId })
        try {
          const dbGroups = await api.db.getGroups(accountId)
          const groups = dbGroups.map(dbGroupToZaloGroup)
          set({ groups, loading: false })
        } catch (error) {
          console.error('Failed to load groups:', error)
          set({ loading: false })
        }
      },

      addGroup: async (accountId, groupData) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const newGroup = {
          id: (groupData as any).id || crypto.randomUUID(),
          account_id: accountId,
          name: groupData.name,
          description: groupData.description || null,
          avatar: groupData.avatar || null,
          member_count: groupData.memberCount,
          is_admin: groupData.isAdmin ? 1 : 0,
          last_activity: groupData.lastActivity?.toISOString() || null,
          type: groupData.type
        }

        try {
          const dbGroup = await api.db.upsertGroup(newGroup)
          set((state) => {
            const index = state.groups.findIndex(g => g.id === newGroup.id)
            const group = dbGroupToZaloGroup(dbGroup)
            if (index !== -1) {
              state.groups[index] = group
            } else {
              state.groups.push(group)
            }
          })
        } catch (error) {
          console.error('Failed to add group:', error)
          throw error
        }
      },

      setGroups: async (accountId, groups) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          for (const group of groups) {
            await get().addGroup(accountId, group)
          }
        } catch (error) {
          console.error('Failed to set groups:', error)
        }
      },

      updateGroup: async (accountId, id, updates) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const dbUpdates: any = {}
        if (updates.name) dbUpdates.name = updates.name
        if (updates.description !== undefined) dbUpdates.description = updates.description
        if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar
        if (updates.memberCount !== undefined) dbUpdates.member_count = updates.memberCount
        if (updates.isAdmin !== undefined) dbUpdates.is_admin = updates.isAdmin ? 1 : 0
        if (updates.lastActivity) dbUpdates.last_activity = updates.lastActivity.toISOString()
        if (updates.type) dbUpdates.type = updates.type

        try {
          await api.db.updateGroup(id, accountId, dbUpdates)
          await get().loadGroups(accountId)
        } catch (error) {
          console.error('Failed to update group:', error)
          throw error
        }
      },

      deleteGroup: async (accountId, id) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          await api.db.deleteGroup(id, accountId)
          set((state) => {
            state.groups = state.groups.filter(g => g.id !== id)
          })
        } catch (error) {
          console.error('Failed to delete group:', error)
          throw error
        }
      },

      getGroupById: (id) => {
        return get().groups.find(g => g.id === id)
      },

      searchGroups: (query) => {
        const q = query.toLowerCase()
        return get().groups.filter(g =>
          g.name.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q)
        )
      },
    })),
    { name: 'GroupsStore' }
  )
)

// Templates Store with Database
interface TemplatesState {
  templates: MessageTemplate[]
  loading: boolean

  loadTemplates: () => Promise<void>
  addTemplate: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateTemplate: (id: string, updates: Partial<MessageTemplate>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  getTemplateById: (id: string) => MessageTemplate | undefined
}

export const useTemplatesStore = create<TemplatesState>()(
  devtools(
    immer((set, get) => ({
      templates: [],
      loading: false,

      loadTemplates: async () => {
        const api = getElectronAPI()
        if (!api?.db) return

        set({ loading: true })
        try {
          const dbTemplates = await api.db.getTemplates()
          const templates = dbTemplates.map(dbTemplateToMessageTemplate)
          set({ templates, loading: false })
        } catch (error) {
          console.error('Failed to load templates:', error)
          set({ loading: false })
        }
      },

      addTemplate: async (templateData) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const newTemplate = {
          id: crypto.randomUUID(),
          name: templateData.name,
          content: templateData.content,
          type: templateData.type || 'personal',
          category: templateData.category || null,
          variables: JSON.stringify(templateData.variables || []),
          media: JSON.stringify(templateData.media || [])
        }

        try {
          const dbTemplate = await api.db.createTemplate(newTemplate)
          set((state) => {
            state.templates.push(dbTemplateToMessageTemplate(dbTemplate))
          })
        } catch (error) {
          console.error('Failed to add template:', error)
          throw error
        }
      },

      updateTemplate: async (id, updates) => {
        const api = getElectronAPI()
        if (!api?.db) return

        const dbUpdates: any = {}
        if (updates.name) dbUpdates.name = updates.name
        if (updates.content) dbUpdates.content = updates.content
        if (updates.type) dbUpdates.type = updates.type
        if (updates.category !== undefined) dbUpdates.category = updates.category
        if (updates.variables) dbUpdates.variables = JSON.stringify(updates.variables)
        if (updates.media) dbUpdates.media = JSON.stringify(updates.media)

        try {
          await api.db.updateTemplate(id, dbUpdates)
          await get().loadTemplates()
        } catch (error) {
          console.error('Failed to update template:', error)
          throw error
        }
      },

      deleteTemplate: async (id) => {
        const api = getElectronAPI()
        if (!api?.db) return

        try {
          await api.db.deleteTemplate(id)
          set((state) => {
            state.templates = state.templates.filter(t => t.id !== id)
          })
        } catch (error) {
          console.error('Failed to delete template:', error)
          throw error
        }
      },

      getTemplateById: (id) => {
        return get().templates.find(t => t.id === id)
      },
    })),
    { name: 'TemplatesStore' }
  )
)

