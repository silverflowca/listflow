import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, CheckSquare, Mic, Plus, ArrowRight } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { pages, tasks, type Page, type Task } from '@/lib/api'
import { formatRelative } from '@/lib/utils'

export function HomePage() {
  const { activeWorkspace } = useWorkspace()
  const [recentPages, setRecentPages] = useState<Page[]>([])
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeWorkspace) return
    Promise.all([
      pages.list(activeWorkspace.id),
      tasks.list({ workspaceId: activeWorkspace.id, limit: 6 }),
    ]).then(([{ pages: p }, { tasks: t }]) => {
      setRecentPages(p.slice(0, 6))
      setRecentTasks(t.slice(0, 6))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [activeWorkspace?.id])

  const createPage = async () => {
    if (!activeWorkspace) return
    const page = await pages.create({ workspaceId: activeWorkspace.id, title: 'Untitled' })
    window.location.href = `/pages/${page.id}`
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="w-16 h-16 bg-ios-blue rounded-ios-xl flex items-center justify-center">
          <CheckSquare size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-semibold text-ios-label">Welcome to ListFlow</h2>
        <p className="text-ios-gray-1 text-sm">Create a workspace to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={activeWorkspace.name}
        actions={
          <Button size="sm" onClick={createPage}>
            <Plus size={14} />
            New Page
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center pt-12"><Spinner /></div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={createPage} className="flex flex-col items-center gap-2 p-4 bg-white rounded-ios-lg shadow-ios hover:shadow-ios-md transition-shadow">
                <div className="w-10 h-10 bg-ios-blue/10 rounded-ios flex items-center justify-center">
                  <FileText size={20} className="text-ios-blue" />
                </div>
                <span className="text-xs font-medium text-ios-label">New Page</span>
              </button>
              <Link to="/tasks" className="flex flex-col items-center gap-2 p-4 bg-white rounded-ios-lg shadow-ios hover:shadow-ios-md transition-shadow">
                <div className="w-10 h-10 bg-ios-green/10 rounded-ios flex items-center justify-center">
                  <CheckSquare size={20} className="text-ios-green" />
                </div>
                <span className="text-xs font-medium text-ios-label">Tasks</span>
              </Link>
              <Link to="/audio" className="flex flex-col items-center gap-2 p-4 bg-white rounded-ios-lg shadow-ios hover:shadow-ios-md transition-shadow">
                <div className="w-10 h-10 bg-ios-red/10 rounded-ios flex items-center justify-center">
                  <Mic size={20} className="text-ios-red" />
                </div>
                <span className="text-xs font-medium text-ios-label">Record</span>
              </Link>
            </div>

            {/* Recent tasks */}
            {recentTasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-ios-label">Recent Tasks</h2>
                  <Link to="/tasks" className="text-xs text-ios-blue flex items-center gap-1">
                    See all <ArrowRight size={12} />
                  </Link>
                </div>
                <Card>
                  <div className="divide-y divide-ios-gray-5">
                    {recentTasks.map(task => (
                      <Link key={task.id} to="/tasks" className="flex items-center gap-3 px-4 py-3 hover:bg-ios-gray-6 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ios-label truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <PriorityBadge priority={task.priority} />
                            <span className="text-xs text-ios-gray-1">{formatRelative(task.created_at)}</span>
                          </div>
                        </div>
                        <StatusBadge status={task.status} />
                      </Link>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Recent pages */}
            {recentPages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-ios-label">Pages</h2>
                  <Link to="/pages" className="text-xs text-ios-blue flex items-center gap-1">
                    See all <ArrowRight size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {recentPages.map(page => (
                    <Link key={page.id} to={`/pages/${page.id}`}>
                      <Card className="p-4 hover:shadow-ios-md transition-shadow cursor-pointer h-full">
                        <div className="flex items-start gap-2">
                          <span className="text-xl">{page.icon ?? '📄'}</span>
                          <div>
                            <p className="text-sm font-medium text-ios-label">{page.title}</p>
                            <p className="text-xs text-ios-gray-1 mt-0.5">{formatRelative(page.updated_at)}</p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {recentPages.length === 0 && recentTasks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-ios-gray-1 text-sm">No content yet. Create your first page or task!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
