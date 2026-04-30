import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-ios-label">{label}</label>}
      <input
        {...props}
        id={inputId}
        className={cn(
          'w-full px-3 py-2 bg-ios-gray-6 border border-ios-gray-4 rounded-ios text-ios-label text-sm',
          'placeholder:text-ios-gray-2 focus:outline-none focus:ring-2 focus:ring-ios-blue focus:border-transparent',
          'transition-all duration-150',
          error && 'border-ios-red focus:ring-ios-red',
          className,
        )}
      />
      {error && <p className="text-xs text-ios-red">{error}</p>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-ios-label">{label}</label>}
      <textarea
        {...props}
        id={inputId}
        className={cn(
          'w-full px-3 py-2 bg-ios-gray-6 border border-ios-gray-4 rounded-ios text-ios-label text-sm',
          'placeholder:text-ios-gray-2 focus:outline-none focus:ring-2 focus:ring-ios-blue focus:border-transparent',
          'transition-all duration-150 resize-none',
          error && 'border-ios-red focus:ring-ios-red',
          className,
        )}
      />
      {error && <p className="text-xs text-ios-red">{error}</p>}
    </div>
  )
}
