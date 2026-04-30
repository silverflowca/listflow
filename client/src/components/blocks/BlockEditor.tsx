import React, { useCallback, useEffect, useRef, useState } from 'react'
import { blocks as blocksApi, type Block } from '@/lib/api'
import { BlockItem } from './Block'
import { BlockMenu } from './BlockMenu'
import { Plus } from 'lucide-react'

interface BlockEditorProps {
  pageId: string
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const [blockList, setBlockList] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [menuPos, setMenuPos] = useState<{ blockId: string; top: number; left: number } | null>(null)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    blocksApi.list(pageId).then(({ blocks }) => {
      setBlockList(blocks)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [pageId])

  const addBlock = useCallback(async (afterIndex: number, type: Block['type'] = 'text') => {
    const { data: after } = { data: blockList[afterIndex] }
    const position = (after?.position ?? 0) + 1

    const newBlock = await blocksApi.create({
      pageId,
      type,
      content: { text: '' },
      position,
    })
    setBlockList(prev => [...prev.slice(0, afterIndex + 1), newBlock, ...prev.slice(afterIndex + 1)])
    // Focus new block
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLElement
      el?.focus()
    }, 50)
  }, [pageId, blockList])

  const updateBlock = useCallback((id: string, content: Record<string, unknown>, type?: Block['type']) => {
    setBlockList(prev => prev.map(b => b.id === id ? { ...b, content, type: type ?? b.type } : b))
    // Debounced save
    const timer = saveTimers.current.get(id)
    if (timer) clearTimeout(timer)
    saveTimers.current.set(id, setTimeout(() => {
      blocksApi.update(id, { content, ...(type && { type }) })
    }, 500))
  }, [])

  const deleteBlock = useCallback(async (id: string, prevIndex: number) => {
    await blocksApi.delete(id)
    setBlockList(prev => prev.filter(b => b.id !== id))
    // Focus previous block
    if (prevIndex > 0) {
      const prevId = blockList[prevIndex - 1]?.id
      setTimeout(() => {
        const el = document.querySelector(`[data-block-id="${prevId}"]`) as HTMLElement
        el?.focus()
      }, 50)
    }
  }, [blockList])

  const handleSlashMenu = useCallback((blockId: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    setMenuPos({ blockId, top: rect.bottom + window.scrollY, left: rect.left })
  }, [])

  const handleMenuSelect = useCallback(async (type: Block['type']) => {
    if (!menuPos) return
    const idx = blockList.findIndex(b => b.id === menuPos.blockId)
    setMenuPos(null)
    // Update current block type
    const block = blockList[idx]
    if (block) {
      updateBlock(block.id, { text: '' }, type)
    }
  }, [menuPos, blockList, updateBlock])

  if (loading) return <div className="p-6 text-ios-gray-1 text-sm">Loading…</div>

  return (
    <div className="relative">
      {blockList.map((block, idx) => (
        <BlockItem
          key={block.id}
          block={block}
          index={idx}
          onUpdate={(content, type) => updateBlock(block.id, content, type)}
          onEnter={() => addBlock(idx)}
          onDelete={() => deleteBlock(block.id, idx)}
          onSlashMenu={(el) => handleSlashMenu(block.id, el)}
        />
      ))}

      {/* Add block button */}
      <button
        onClick={() => addBlock(blockList.length - 1)}
        className="flex items-center gap-2 px-6 py-3 text-ios-gray-2 hover:text-ios-gray-1 text-sm transition-colors group"
      >
        <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">Add block</span>
      </button>

      {/* Block type menu */}
      {menuPos && (
        <BlockMenu
          top={menuPos.top}
          left={menuPos.left}
          onSelect={handleMenuSelect}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  )
}
