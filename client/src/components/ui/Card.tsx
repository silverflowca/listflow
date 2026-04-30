import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
}

export function Card({ elevated, className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        'bg-white rounded-ios-lg border border-ios-gray-5/70',
        elevated ? 'shadow-ios-md' : 'shadow-ios',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('px-4 py-3 border-b border-ios-gray-5', className)}>
      {children}
    </div>
  )
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('px-4 py-3', className)}>
      {children}
    </div>
  )
}
