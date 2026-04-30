import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Folder } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { pages as pagesApi, type Page } from '@/lib/api'
import { formatRelative } from '@/lib/utils'

export function PagesListPage() {
  const { activeWorkspace } = useWorkspace()
  const [pageList, setPageList] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeWorkspace) return
    pagesApi.list(activeWorkspace.id).then(({ pages }) => {
      setPageList(pages)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [activeWorkspace?.id])

  const createPage = async () => {
    if (!activeWorkspace) return
    const page = await pagesApi.create({ workspaceId: activeWorkspace.id, title: 'Untitled' })
    setPageList(prev => [page, ...prev])
    window.location.href = `/pages/${page.id}`
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Pages"
        actions={<Button size="sm" onClick={createPage}><Plus size={14} />New Page</Button>}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? <div className="flex justify-center pt-12"><Spinner /></div> :
          pageList.length === 0 ? (
            <div className="text-center py-12">
              <Folder size={40} className="mx-auto mb-3 text-ios-gray-3" />
              <p className="text-ios-gray-1 text-sm">No pages yet</p>
              <Button className="mt-4" onClick={createPage}>Create First Page</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {pageList.map(page => (
                <Link key={page.id} to={`/pages/${page.id}`}>
                  <Card className="p-4 h-32 flex flex-col hover:shadow-ios-md transition-shadow cursor-pointer">
                    <div className="text-2xl mb-2">{page.icon ?? '📄'}</div>
                    <p className="text-sm font-medium text-ios-label flex-1 line-clamp-2">{page.title}</p>
                    <p className="text-xs text-ios-gray-1 mt-auto">{formatRelative(page.updated_at)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
