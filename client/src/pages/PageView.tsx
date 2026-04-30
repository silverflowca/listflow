import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BlockEditor } from '@/components/blocks/BlockEditor'
import { Spinner } from '@/components/ui/Spinner'
import { pages as pagesApi, type Page } from '@/lib/api'

export function PageView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    pagesApi.get(id).then(p => {
      setPage(p)
      setTitle(p.title)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const saveTitle = async () => {
    if (!page || title === page.title) return
    const updated = await pagesApi.update(page.id, { title })
    setPage(updated)
  }

  const deletePage = async () => {
    if (!page || !confirm('Delete this page?')) return
    await pagesApi.delete(page.id)
    navigate('/pages')
  }

  if (loading) return <div className="flex justify-center pt-12"><Spinner /></div>
  if (!page) return <div className="p-6 text-ios-red text-sm">Page not found</div>

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={page.title}
        actions={
          <button onClick={deletePage} className="p-2 text-ios-gray-1 hover:text-ios-red hover:bg-red-50 rounded-ios transition-colors">
            <Trash2 size={16} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-6 py-8">
        {/* Page icon + title */}
        <div className="mb-6">
          <div className="text-4xl mb-3 cursor-pointer" title="Click to change icon">{page.icon ?? '📄'}</div>
          {editingTitle ? (
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => { setEditingTitle(false); saveTitle() }}
              onKeyDown={e => e.key === 'Enter' && titleRef.current?.blur()}
              className="text-4xl font-bold text-ios-label w-full outline-none border-none bg-transparent"
              autoFocus
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="text-4xl font-bold text-ios-label cursor-text hover:bg-ios-gray-6 rounded-ios px-2 py-1 -mx-2 transition-colors"
            >
              {page.title || 'Untitled'}
            </h1>
          )}
        </div>

        {/* Block editor */}
        <BlockEditor pageId={page.id} />
      </div>
    </div>
  )
}
