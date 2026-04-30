import React from 'react'
import { cn } from '@/lib/utils'
import type { AppRole, UserStatus } from '@/lib/api'

const ROLE_STYLES: Record<AppRole, string> = {
  admin:   'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  member:  'bg-green-100 text-green-700',
  viewer:  'bg-ios-gray-5 text-ios-gray-2',
  guest:   'bg-orange-100 text-orange-700',
}

const STATUS_STYLES: Record<UserStatus, string> = {
  active:    'bg-green-100 text-green-700',
  invited:   'bg-yellow-100 text-yellow-700',
  inactive:  'bg-ios-gray-5 text-ios-gray-2',
  suspended: 'bg-red-100 text-red-700',
}

export function RoleBadge({ role, className }: { role: AppRole; className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize', ROLE_STYLES[role], className)}>
      {role}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: UserStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[status], className)}>
      {status}
    </span>
  )
}
