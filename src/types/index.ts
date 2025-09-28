// Re-export all types
export * from './zalo'
export * from './electron'

// Common utility types
export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface TableColumn<T = any> {
  key: keyof T
  title: string
  sortable?: boolean
  width?: string | number
  render?: (value: any, record: T) => React.ReactNode
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export interface InputProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  error?: string
  disabled?: boolean
  required?: boolean
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  className?: string
}

export interface ApiError {
  message: string
  code?: string | number
  details?: any
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  message?: string
}

// Theme types
export interface Theme {
  name: string
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    error: string
    background: string
    surface: string
    text: string
    textSecondary: string
    border: string
  }
}

// Route types
export interface RouteConfig {
  path: string
  component: React.ComponentType
  title: string
  icon?: React.ReactNode
  protected?: boolean
  exact?: boolean
}
