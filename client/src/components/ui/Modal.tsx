import React, { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={cn(
          'relative w-full bg-white rounded-t-ios-xl sm:rounded-ios-xl shadow-ios-lg animate-slide-up',
          'sm:animate-fade-in sm:mx-4',
          sizes[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-ios-gray-5">
            <h2 className="text-base font-semibold text-ios-label">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-ios-gray-6 text-ios-gray-1 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-5 py-4 border-t border-ios-gray-5 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
