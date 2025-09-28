import React from 'react'
import { cn } from '@/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center font-medium rounded-full transition-colors'
    
    const variants = {
      default: 'bg-secondary-100 text-secondary-800',
      success: 'bg-success-50 text-success-700 border border-success-200',
      warning: 'bg-warning-50 text-warning-700 border border-warning-200',
      error: 'bg-error-50 text-error-700 border border-error-200',
      info: 'bg-primary-50 text-primary-700 border border-primary-200',
      outline: 'border border-secondary-300 text-secondary-700 bg-white'
    }
    
    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3 py-1.5 text-sm'
    }

    return (
      <span
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }
