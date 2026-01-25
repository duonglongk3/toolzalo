// Database Models for SQLite
// These models represent the database schema

export interface DbAccount {
  id: string
  name: string
  phone: string
  imei: string
  cookie: string
  user_agent: string
  status: 'online' | 'offline' | 'error'
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface DbFriend {
  id: string
  account_id: string
  name: string
  display_name: string
  phone: string | null
  avatar: string | null
  status: 'online' | 'offline' | 'unknown'
  added_at: string
  last_interaction: string | null
}

export interface DbFriendTag {
  friend_id: string
  account_id: string
  tag: string
  created_at: string
}

export interface DbGroup {
  id: string
  account_id: string
  name: string
  description: string | null
  avatar: string | null
  member_count: number
  is_admin: number // SQLite boolean (0 or 1)
  joined_at: string
  last_activity: string | null
  type: 'public' | 'private'
}

export interface DbMessageTemplate {
  id: string
  name: string
  content: string
  type: 'personal' | 'group'
  category: string | null
  variables: string // JSON string
  media: string // JSON string
  created_at: string
  updated_at: string
}

export interface DbMessageLog {
  id: string
  account_id: string
  recipient_id: string
  recipient_type: 'friend' | 'group'
  content: string
  status: 'sent' | 'failed' | 'delivered' | 'read'
  sent_at: string
  error: string | null
}

export interface DbShareContent {
  id: string
  title: string
  content: string
  category_id: string | null
  media: string // JSON string
  created_at: string
  updated_at: string
}

export interface DbShareCategory {
  id: string
  name: string
  description: string | null
  color: string | null
  created_at: string
}

// Helper types for inserts (without auto-generated fields)
export type DbAccountInsert = Omit<DbAccount, 'created_at' | 'updated_at'>
export type DbFriendInsert = Omit<DbFriend, 'added_at'>
export type DbGroupInsert = Omit<DbGroup, 'joined_at'>
export type DbMessageTemplateInsert = Omit<DbMessageTemplate, 'created_at' | 'updated_at'>
export type DbMessageLogInsert = Omit<DbMessageLog, 'sent_at'>
export type DbShareContentInsert = Omit<DbShareContent, 'created_at' | 'updated_at'>
export type DbShareCategoryInsert = Omit<DbShareCategory, 'created_at'>

// Helper types for updates (all fields optional except id)
export type DbAccountUpdate = Partial<Omit<DbAccount, 'id' | 'created_at' | 'updated_at'>>
export type DbFriendUpdate = Partial<Omit<DbFriend, 'id' | 'account_id' | 'added_at'>>
export type DbGroupUpdate = Partial<Omit<DbGroup, 'id' | 'account_id' | 'joined_at'>>
export type DbMessageTemplateUpdate = Partial<Omit<DbMessageTemplate, 'id' | 'created_at' | 'updated_at'>>
export type DbShareContentUpdate = Partial<Omit<DbShareContent, 'id' | 'created_at' | 'updated_at'>>

// Query result types with joined data
export interface FriendWithTags extends DbFriend {
  tags: string[]
}

export interface GroupWithDetails extends DbGroup {
  account_name?: string
}

// Migration types
export interface MigrationData {
  accounts: DbAccountInsert[]
  friends: DbFriendInsert[]
  friendTags: DbFriendTag[]
  groups: DbGroupInsert[]
  templates: DbMessageTemplateInsert[]
  shareContent: DbShareContentInsert[]
  shareCategories: DbShareCategoryInsert[]
}

