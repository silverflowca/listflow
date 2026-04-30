import React from 'react'
import { cn } from '@/lib/utils'
import type { AppUser } from '@/lib/api'

interface UserAvatarProps {
  user: Pick<AppUser, 'name' | 'initials' | 'color' | 'avatar_url'>
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showTooltip?: boolean
}

const SIZES = {
  xs:  'w-5 h-5 text-[9px]',
  sm:  'w-7 h-7 text-xs',
  md:  'w-9 h-9 text-sm',
  lg:  'w-11 h-11 text-base',
  xl:  'w-14 h-14 text-lg',
}

export function UserAvatar({ user, size = 'md', className, showTooltip }: UserAvatarProps) {
  const cls = cn('rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 select-none', SIZES[size], className)

  const inner = user.avatar_url
    ? <img src={user.avatar_url} alt={user.name} className={cn('rounded-full object-cover', SIZES[size], className)} />
    : <div className={cls} style={{ backgroundColor: user.color }}>{user.initials}</div>

  if (showTooltip) {
    return (
      <div title={user.name} className="relative">
        {inner}
      </div>
    )
  }
  return inner
}

/** Stacked row of avatars (max shown + overflow badge) */
export function UserAvatarStack({ users, max = 4, size = 'sm' }: { users: Pick<AppUser, 'name' | 'initials' | 'color' | 'avatar_url'>[], max?: number, size?: UserAvatarProps['size'] }) {
  const shown = users.slice(0, max)
  const overflow = users.length - max

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u, i) => (
        <div key={i} className="ring-2 ring-white rounded-full">
          <UserAvatar user={u} size={size} showTooltip />
        </div>
      ))}
      {overflow > 0 && (
        <div className={cn('rounded-full flex items-center justify-center bg-ios-gray-4 text-ios-gray-1 font-medium ring-2 ring-white', SIZES[size ?? 'sm'])}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
