import React, { useEffect, useRef } from 'react'
import { Type, Heading1, Heading2, Heading3, CheckSquare, List, ListOrdered, Code, Minus, type LucideIcon } from 'lucide-react'
import type { Block } from '@/lib/api'

const BLOCK_TYPES: Array<{ type: Block['type']; label: string; icon: LucideIcon }> = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'h1', label: 'Heading 1', icon: Heading1 },
  { type: 'h2', label: 'Heading 2', icon: Heading2 },
  { type: 'h3', label: 'Heading 3', icon: Heading3 },
  { type: 'todo', label: 'To-do', icon: CheckSquare },
  { type: 'bullet', label: 'Bullet list', icon: List },
  { type: 'numbered', label: 'Numbered list', icon: ListOrdered },
  { type: 'code', label: 'Code block', icon: Code },
  { type: 'divider', label: 'Divider', icon: Minus },
]

interface BlockMenuProps {
  top: number
  left: number
  onSelect: (type: Block['type']) => void
  onClose: () => void
}

export function BlockMenu({ top, left, onSelect, onClose }: BlockMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 100 }}
      className="bg-white rounded-ios-lg shadow-ios-lg border border-ios-gray-5 py-1 w-52 animate-fade-in"
    >
      <div className="px-3 py-1.5 text-xs font-medium text-ios-gray-1 border-b border-ios-gray-5">
        Block type
      </div>
      {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ios-label hover:bg-ios-gray-6 transition-colors"
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  )
}
