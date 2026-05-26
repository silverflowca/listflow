import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return formatDate(d)
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export const PRIORITY_COLORS = {
  low: 'text-ios-gray-1',
  medium: 'ws-text',
  high: 'text-ios-orange',
  urgent: 'text-ios-red',
} as const

export const STATUS_COLORS = {
  todo: 'bg-ios-gray-5 text-ios-gray-1',
  in_progress: 'ws-bg ws-text',
  review: 'bg-purple-100 text-ios-purple',
  done: 'bg-green-100 text-ios-green',
  cancelled: 'bg-ios-gray-5 text-ios-gray-2 line-through',
} as const

export const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
} as const

/**
 * Generate a human-readable task ID: up to 3 initials from the workspace
 * name + zero-padded task_number. e.g. "Kingdom Dev Team" + 42 → "KDT042"
 */
export function taskShortId(workspaceName: string, taskNumber: number | undefined): string {
  if (!taskNumber) return ''
  const initials = workspaceName.trim().split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 3)
  return `${initials}${String(taskNumber).padStart(3, '0')}`
}
