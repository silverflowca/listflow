import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { AppUser } from '@/lib/api'
import { UserAvatar } from './UserAvatar'

interface UserSelectProps {
  users: AppUser[]
  value?: string[]          // selected user ids
  onChange: (ids: string[]) => void
  multi?: boolean
  placeholder?: string
  className?: string
}

export function UserSelect({ users, value = [], onChange, multi = false, placeholder = 'Select user…', className }: UserSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const selected = users.filter(u => value.includes(u.id))

  function toggle(id: string) {
    if (multi) {
      onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
    } else {
      onChange([id])
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-ios-gray-5 bg-white text-left text-sm hover:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
      >
        {selected.length === 0 ? (
          <span className="text-ios-gray-3">{placeholder}</span>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {selected.map(u => (
              <div key={u.id} className="flex items-center gap-1 bg-ios-gray-6 rounded-full px-1.5 py-0.5">
                <UserAvatar user={u} size="xs" />
                <span className="text-xs">{u.name}</span>
              </div>
            ))}
          </div>
        )}
        <span className="ml-auto text-ios-gray-3">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-ios-gray-5 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-ios-gray-6">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full px-2 py-1 text-sm bg-ios-gray-6 rounded-lg focus:outline-none"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-ios-gray-3">No users found</li>
            )}
            {filtered.map(u => (
              <li
                key={u.id}
                onClick={() => toggle(u.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-ios-gray-6 text-sm',
                  value.includes(u.id) && 'bg-blue-50'
                )}
              >
                <UserAvatar user={u} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.name}</div>
                  <div className="text-xs text-ios-gray-3 truncate">{u.email}</div>
                </div>
                {value.includes(u.id) && <span className="text-ios-blue text-xs">✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
