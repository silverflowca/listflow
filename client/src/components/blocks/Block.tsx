import React, { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Block } from '@/lib/api'

interface BlockItemProps {
  block: Block
  index: number
  onUpdate: (content: Record<string, unknown>, type?: Block['type']) => void
  onEnter: () => void
  onDelete: () => void
  onSlashMenu: (el: HTMLElement) => void
}

const TYPE_CLASSES: Record<Block['type'], string> = {
  text: 'text-ios-label text-base leading-relaxed',
  h1: 'text-3xl font-bold text-ios-label leading-tight',
  h2: 'text-2xl font-semibold text-ios-label leading-tight',
  h3: 'text-xl font-semibold text-ios-label leading-tight',
  todo: 'text-ios-label text-base leading-relaxed',
  bullet: 'text-ios-label text-base leading-relaxed',
  numbered: 'text-ios-label text-base leading-relaxed',
  code: 'font-mono text-sm text-ios-label bg-ios-gray-6 rounded-ios px-1',
  divider: '',
  image: '',
  audio: '',
  embed: '',
}

export function BlockItem({ block, index, onUpdate, onEnter, onDelete, onSlashMenu }: BlockItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const text = (block.content.text as string) ?? ''
  const checked = block.content.checked as boolean | undefined

  useEffect(() => {
    if (ref.current && ref.current.textContent !== text) {
      ref.current.textContent = text
    }
  }, []) // Only on mount

  if (block.type === 'divider') {
    return <hr className="border-ios-gray-5 my-4 mx-6" />
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEnter()
    }
    if (e.key === 'Backspace' && !ref.current?.textContent) {
      e.preventDefault()
      onDelete()
    }
    if (e.key === '/' && !ref.current?.textContent) {
      onSlashMenu(ref.current!)
    }
  }

  const handleInput = () => {
    const t = ref.current?.textContent ?? ''
    onUpdate({ ...block.content, text: t })
  }

  const prefix = block.type === 'bullet' ? '•' :
    block.type === 'numbered' ? `${index + 1}.` : ''

  return (
    <div className="flex items-start gap-2 px-6 py-1 group hover:bg-ios-gray-6/50 transition-colors">
      {prefix && <span className="text-ios-gray-1 text-sm mt-0.5 shrink-0 w-4">{prefix}</span>}
      {block.type === 'todo' && (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={() => onUpdate({ ...block.content, checked: !checked })}
          className="mt-1.5 shrink-0 rounded accent-ios-blue"
        />
      )}
      <div
        ref={ref}
        data-block-id={block.id}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        className={cn(
          'flex-1 outline-none min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-ios-gray-3',
          TYPE_CLASSES[block.type],
          block.type === 'todo' && checked && 'line-through text-ios-gray-2',
        )}
        data-placeholder="Type '/' for commands…"
      />
    </div>
  )
}
