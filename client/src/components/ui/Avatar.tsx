import React from 'react'
import { cn, initials } from '@/lib/utils'

interface AvatarProps {
  name?: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const COLORS = [
  'bg-ios-blue', 'bg-ios-green', 'bg-ios-orange', 'bg-ios-purple',
  'bg-ios-teal', 'bg-ios-indigo', 'bg-ios-red',
]

function colorForName(name: string): string {
  const i = name.charCodeAt(0) % COLORS.length
  return COLORS[i]
}

export function Avatar({ name = '?', src, size = 'md', className }: AvatarProps) {
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' }

  if (src) {
    return <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size], className)} />
  }

  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold', colorForName(name), sizes[size], className)}>
      {initials(name)}
    </div>
  )
}
