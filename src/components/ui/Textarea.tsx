import React from 'react'
import { cn } from '@/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    className, 
    label,
    error,
    helperText,
    disabled,
    ...props 
  }, ref) => {
    const textareaId = React.useId()

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={textareaId}
            className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1.5"
          >
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        
        <textarea
          id={textareaId}
          className={cn(
            'block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm placeholder-secondary-400 shadow-sm transition-colors resize-none',
            'dark:bg-secondary-800 dark:border-secondary-600 dark:text-secondary-100 dark:placeholder-secondary-500',
            'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
            'disabled:cursor-not-allowed disabled:bg-secondary-50 disabled:text-secondary-500 dark:disabled:bg-secondary-700',
            error && 'border-error-300 focus:border-error-500 focus:ring-error-500',
            className
          )}
          disabled={disabled}
          ref={ref}
          {...props}
        />
        
        {(error || helperText) && (
          <p className={cn(
            'mt-1.5 text-xs',
            error ? 'text-error-600' : 'text-secondary-500 dark:text-secondary-400'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
