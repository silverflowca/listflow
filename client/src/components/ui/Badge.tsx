import React from 'react'
import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import type { Task } from '@/lib/api'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray'
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-ios-gray-5 text-ios-gray-1',
    blue: 'bg-blue-100 text-ios-blue',
    green: 'bg-green-100 text-ios-green',
    orange: 'bg-orange-100 text-ios-orange',
    red: 'bg-red-100 text-ios-red',
    purple: 'bg-purple-100 text-ios-purple',
    gray: 'bg-ios-gray-5 text-ios-gray-2',
  }
  return (
    <span {...props} className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', variants[variant], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: Task['status'] }) {
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const colors = {
    low: 'text-ios-gray-1',
    medium: 'text-ios-blue',
    high: 'text-ios-orange',
    urgent: 'text-ios-red font-semibold',
  }
  const dots = {
    low: '○',
    medium: '◑',
    high: '●',
    urgent: '⬤',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', colors[priority])}>
      <span>{dots[priority]}</span>
      <span className="capitalize">{priority}</span>
    </span>
  )
}
