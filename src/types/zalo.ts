// Zalo Account Types
export interface ZaloAccount {
  id: string
  name: string
  phone: string
  imei: string
  cookie: string
  userAgent: string
  status: 'online' | 'offline' | 'error'
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ZaloCredentials {
  imei: string
  cookie: string
  userAgent: string
}

// Friend Types
export interface ZaloFriend {
  id: string
  name: string
  displayName: string
  phone?: string
  avatar?: string
  status: 'online' | 'offline' | 'unknown'
  tags: string[]
  addedAt: Date
  lastInteraction?: Date
}

// Labels
export interface ZaloLabel {
  id: number
  text: string
  textKey: string
  conversations: string[]
  color?: string
  offset?: number
  emoji?: string
  createTime?: number
}

export interface ZaloLabelsResult {
  labels: ZaloLabel[]
  version: number
  lastUpdateTime: number
}

// Group Types
export interface ZaloGroup {
  id: string
  name: string
  description?: string
  avatar?: string
  memberCount: number
  isAdmin: boolean
  joinedAt: Date
  lastActivity?: Date
  type: 'public' | 'private'
}

export interface ZaloGroupMember {
  id: string
  name: string
  displayName: string
  phone?: string
  avatar?: string
  role: 'admin' | 'member'
  joinedAt: Date
}

// Message Types
export interface MediaAttachment {
  id: string
  name: string
  path: string
  kind: 'image' | 'video' | 'file'
  mime?: string
  size?: number
}

export interface MessageTemplate {
  id: string
  name: string
  content: string
  type: 'personal' | 'group'
  category?: string
  variables?: string[]
  media?: MediaAttachment[]
  createdAt: Date
  updatedAt: Date
}

export interface BulkMessage {
  id: string
  templateId: string
  recipients: string[]
  status: 'pending' | 'sending' | 'completed' | 'failed'
  sentCount: number
  failedCount: number
  scheduledAt?: Date
  createdAt: Date
  completedAt?: Date
}

export interface MessageLog {
  id: string
  accountId: string
  recipientId: string
  recipientType: 'friend' | 'group'
  content: string
  status: 'sent' | 'failed' | 'delivered' | 'read'
  sentAt: Date
  error?: string
}

// Share Content Types
export interface ShareContent {
  id: string
  title: string
  description?: string
  url?: string
  imageUrl?: string
  type: 'link' | 'image' | 'video' | 'text'
  tags: string[]
  createdAt: Date
}

export interface ShareCategory {
  id: string
  name: string
  description?: string
  color: string
  createdAt: Date
}

// Analytics Types
export interface MessageAnalytics {
  totalSent: number
  totalDelivered: number
  totalRead: number
  totalFailed: number
  successRate: number
  period: 'day' | 'week' | 'month'
  date: Date
}

export interface GroupAnalytics {
  groupId: string
  groupName: string
  memberCount: number
  activeMembers: number
  messagesSent: number
  lastActivity: Date
}

// API Response Types
export interface ZaloApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: number
}

// Configuration Types
export interface AppConfig {
  theme: 'light' | 'dark' | 'system'
  language: 'vi' | 'en'
  autoSave: boolean
  notifications: boolean
  defaultAccount?: string
  messageDelay: number // milliseconds between messages
  maxRetries: number
  backupEnabled: boolean
  backupInterval: number // hours
}

// Export/Import Types
export interface ExportData {
  accounts: ZaloAccount[]
  friends: ZaloFriend[]
  groups: ZaloGroup[]
  templates: MessageTemplate[]
  shareContent: ShareContent[]
  categories: ShareCategory[]
  exportedAt: Date
  version: string
}

// Search and Filter Types
export interface SearchFilters {
  query?: string
  tags?: string[]
  dateFrom?: Date
  dateTo?: Date
  status?: string[]
  type?: string
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Notification Types
export interface AppNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  actions?: NotificationAction[]
  createdAt: Date
}

export interface NotificationAction {
  label: string
  action: () => void
  style?: 'primary' | 'secondary'
}

// Task/Job Types
export interface BackgroundTask {
  id: string
  type: 'bulk_message' | 'friend_sync' | 'group_sync' | 'backup'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0-100
  message?: string
  startedAt?: Date
  completedAt?: Date
  error?: string
}

// Validation Types
export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface FormValidation {
  isValid: boolean
  errors: ValidationError[]
}
