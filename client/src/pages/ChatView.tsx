import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Hash, Plus, Send, Paperclip, Pin, CheckSquare, X, MessageSquare } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWs } from '@/hooks/useWs'
import { chat as chatApi, users as usersApi, type ChatChannel, type ChatMessage, type AppUser } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isOwn,
  user,
  workspaceId,
  channelId,
  onPinned,
}: {
  msg: ChatMessage
  isOwn: boolean
  user: AppUser | undefined
  workspaceId: string
  channelId: string
  onPinned: (msg: ChatMessage, taskId: string) => void
}) {
  const [pinning, setPinning] = useState(false)
  const [pinned, setPinned] = useState(!!msg.task_id)

  const displayName = user?.name || user?.email?.split('@')[0] || 'Unknown'
  const isImage = msg.file_type?.startsWith('image/')

  async function handlePin() {
    if (pinned || pinning) return
    setPinning(true)
    try {
      const result = await chatApi.pinAsTask(channelId, msg.id, workspaceId)
      setPinned(true)
      onPinned(msg, result.task.id)
    } catch (e) {
      console.error('Pin failed', e)
    } finally {
      setPinning(false)
    }
  }

  return (
    <div className={cn('flex gap-2.5 group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        <Avatar
          name={user?.name || user?.email || '?'}
          src={user?.avatar_url}
          size="sm"
        />
      </div>

      {/* Bubble content */}
      <div className={cn('flex flex-col max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Name + time */}
        <div className={cn('flex items-baseline gap-1.5 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-xs font-semibold text-ios-label">
            {isOwn ? 'You' : displayName}
          </span>
          <span className="text-[11px] text-ios-gray-3">{formatTime(msg.created_at)}</span>
        </div>

        {/* Bubble */}
        <div className={cn(
          'relative px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
          isOwn
            ? 'rounded-tr-sm bg-[var(--ws-color,#007AFF)] text-white'
            : 'rounded-tl-sm bg-white border border-ios-gray-5 text-ios-label shadow-sm'
        )}>
          {/* Text body */}
          {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}

          {/* Image attachment */}
          {isImage && msg.file_url && (
            <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
              <img
                src={msg.file_url}
                alt={msg.file_name || 'attachment'}
                className="max-w-xs max-h-48 rounded-xl object-cover cursor-zoom-in"
              />
            </a>
          )}

          {/* Non-image file */}
          {!isImage && msg.file_url && (
            <a
              href={msg.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 mt-1 text-xs underline',
                isOwn ? 'text-white/80' : 'text-ios-blue'
              )}
            >
              <Paperclip size={12} />
              {msg.file_name || 'attachment'}
            </a>
          )}

          {/* Task badge if pinned */}
          {pinned && (
            <div className={cn(
              'mt-1.5 flex items-center gap-1 text-[11px]',
              isOwn ? 'text-white/70' : 'text-ios-green'
            )}>
              <CheckSquare size={11} />
              <span>Task created</span>
            </div>
          )}
        </div>

        {/* Pin button — shown on hover */}
        {!pinned && (
          <button
            onClick={handlePin}
            disabled={pinning}
            className={cn(
              'mt-1 flex items-center gap-1 text-[11px] text-ios-gray-3 hover:text-ios-blue transition-colors opacity-0 group-hover:opacity-100',
              pinning && 'opacity-50 cursor-wait'
            )}
          >
            <Pin size={11} />
            {pinning ? 'Creating task...' : 'Pin as task'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Message Input ─────────────────────────────────────────────────────────────

function MessageInput({
  channelId,
  currentUserName,
  onSent,
  onFileUploaded,
}: {
  channelId: string
  currentUserName: string
  onSent: (msg: ChatMessage) => void
  onFileUploaded: (msg: ChatMessage) => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const emitTyping = useCallback(() => {
    chatApi.typing(channelId, currentUserName).catch(() => {})
  }, [channelId, currentUserName])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }
    // Debounced typing indicator
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(emitTyping, 400)
  }

  async function handleSend() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    try {
      const msg = await chatApi.send(channelId, body)
      onSent(msg)
    } catch (e) {
      console.error('Send failed', e)
      setText(body) // restore on failure
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const msg = await chatApi.upload(channelId, file)
      onFileUploaded(msg)
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="shrink-0 border-t border-ios-gray-5 bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        {/* File attachment */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 p-2 rounded-xl text-ios-gray-2 hover:text-ios-blue hover:bg-ios-gray-6 transition-colors"
          title="Attach file"
        >
          {uploading ? <Spinner size="sm" /> : <Paperclip size={18} />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFile}
        />

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-ios-gray-4 bg-ios-gray-6 px-3.5 py-2 text-sm text-ios-label placeholder:text-ios-gray-3 focus:outline-none focus:border-[var(--ws-color,#007AFF)] focus:bg-white transition-colors leading-relaxed max-h-32 overflow-y-auto"
          style={{ minHeight: '38px' }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 128) + 'px'
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[var(--ws-color,#007AFF)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          title="Send"
        >
          {sending ? <Spinner size="sm" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}

// ── Channel List ──────────────────────────────────────────────────────────────

function ChannelList({
  channels,
  activeId,
  onSelect,
  onNew,
}: {
  channels: ChatChannel[]
  activeId: string | null
  onSelect: (ch: ChatChannel) => void
  onNew: () => void
}) {
  return (
    <div className="w-48 shrink-0 border-r border-ios-gray-5 flex flex-col bg-ios-gray-6/30 overflow-hidden">
      <div className="px-3 pt-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ios-gray-2">Channels</span>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
        {channels.map(ch => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch)}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-ios text-sm transition-colors text-left',
              activeId === ch.id
                ? 'font-medium text-[var(--ws-color,#007AFF)] bg-[var(--ws-color-light,#e8f4ff)]'
                : 'text-ios-secondary hover:bg-ios-gray-5/60'
            )}
          >
            <Hash size={14} className="shrink-0 opacity-60" />
            <span className="truncate">{ch.name}</span>
          </button>
        ))}
      </div>
      <div className="px-1.5 pb-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-ios text-xs text-ios-gray-2 hover:bg-ios-gray-5/60 hover:text-ios-blue transition-colors"
        >
          <Plus size={13} />
          New Channel
        </button>
      </div>
    </div>
  )
}

// ── New Channel Modal ─────────────────────────────────────────────────────────

function NewChannelModal({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string
  onClose: () => void
  onCreated: (ch: ChatChannel) => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErr('Name required')
    setSaving(true)
    try {
      const ch = await chatApi.createChannel({ workspaceId, name: name.trim(), description: desc.trim() || undefined })
      onCreated(ch)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="New Channel" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-sm text-ios-red bg-red-50 p-2 rounded-ios">{err}</p>}
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Name *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. issues, prayer, general" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Description</label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main ChatView ─────────────────────────────────────────────────────────────

export function ChatView() {
  const { activeWorkspace } = useWorkspace()
  const { user: authUser } = useAuth()
  const { subscribe } = useWs()

  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [users, setUsers] = useState<Map<string, AppUser>>(new Map())
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [newChannelOpen, setNewChannelOpen] = useState(false)
  const [typingLabel, setTypingLabel] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workspaceId = activeWorkspace?.id ?? ''

  // Load users once
  useEffect(() => {
    usersApi.list().then(({ users: list }) => {
      setUsers(new Map(list.map(u => [u.id, u])))
    }).catch(() => {})
  }, [])

  // Load channels when workspace changes
  useEffect(() => {
    if (!workspaceId) return
    chatApi.channels(workspaceId).then(({ channels: list }) => {
      setChannels(list)
      if (list.length > 0 && !activeChannel) {
        setActiveChannel(list[0])
      }
    }).catch(console.error)
  }, [workspaceId])

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannel) return
    setLoading(true)
    setMessages([])
    chatApi.messages(activeChannel.id).then(({ messages: list }) => {
      setMessages(list)
      setHasMore(list.length >= 50)
      setTimeout(scrollToBottom, 50)
    }).catch(console.error).finally(() => setLoading(false))
  }, [activeChannel?.id])

  // WebSocket: new message
  useEffect(() => {
    const unsub = subscribe('chat.message', (e) => {
      const msg = e.payload.message as ChatMessage
      if (msg.channel_id === activeChannel?.id) {
        setMessages(prev => {
          // Deduplicate (optimistic sends)
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        setTimeout(scrollToBottom, 30)
      }
    })
    return unsub
  }, [activeChannel?.id, subscribe])

  // WebSocket: typing indicator
  useEffect(() => {
    const unsub = subscribe('chat.typing', (e) => {
      const { channelId, userId, name } = e.payload as { channelId: string; userId: string; name: string }
      if (channelId !== activeChannel?.id) return
      // Don't show own typing
      if (userId === authUser?.id) return
      setTypingLabel(`${name} is typing…`)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => setTypingLabel(null), 3000)
    })
    return unsub
  }, [activeChannel?.id, authUser?.id, subscribe])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadMore() {
    if (!activeChannel || loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    const before = messages[0].created_at
    try {
      const { messages: older } = await chatApi.messages(activeChannel.id, before)
      setMessages(prev => [...older, ...prev])
      setHasMore(older.length >= 50)
    } finally {
      setLoadingMore(false)
    }
  }

  function handleScroll() {
    const el = scrollContainerRef.current
    if (!el) return
    if (el.scrollTop < 80) loadMore()
  }

  function handleMessageSent(msg: ChatMessage) {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev
      return [...prev, msg]
    })
    setTimeout(scrollToBottom, 30)
  }

  function handlePinned(original: ChatMessage, taskId: string) {
    setMessages(prev => prev.map(m => m.id === original.id ? { ...m, task_id: taskId } : m))
  }

  if (!workspaceId) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Chat" subtitle="Real-time messaging" accentColor="var(--ws-color,#007AFF)" />
        <div className="flex-1 flex items-center justify-center text-ios-gray-3">
          <div className="text-center">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a workspace to start chatting</p>
          </div>
        </div>
      </div>
    )
  }

  const currentUserId = authUser?.id ?? ''
  const currentUserName = authUser?.user_metadata?.name ?? authUser?.email?.split('@')[0] ?? 'You'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Chat"
        subtitle={activeChannel ? `#${activeChannel.name}` : activeWorkspace?.name ?? ''}
        accentColor="var(--ws-color,#007AFF)"
        actions={
          <Button size="sm" onClick={() => setNewChannelOpen(true)}>
            <Plus size={14} className="mr-1" /> Channel
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Channel sidebar */}
        <ChannelList
          channels={channels}
          activeId={activeChannel?.id ?? null}
          onSelect={ch => setActiveChannel(ch)}
          onNew={() => setNewChannelOpen(true)}
        />

        {/* Main chat area */}
        <div className="flex flex-col flex-1 overflow-hidden bg-ios-gray-6/20">
          {!activeChannel ? (
            <div className="flex-1 flex items-center justify-center text-ios-gray-3">
              <p className="text-sm">Select a channel</p>
            </div>
          ) : (
            <>
              {/* Message list */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              >
                {/* Load more indicator */}
                {loadingMore && (
                  <div className="flex justify-center py-2">
                    <Spinner size="sm" />
                  </div>
                )}

                {/* Load more button if there are older messages */}
                {hasMore && !loadingMore && messages.length > 0 && (
                  <div className="flex justify-center py-1">
                    <button
                      onClick={loadMore}
                      className="text-xs text-ios-blue hover:underline"
                    >
                      Load earlier messages
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-center py-16">
                    <Spinner />
                  </div>
                )}

                {!loading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-ios-gray-3">
                    <Hash size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">#{activeChannel.name}</p>
                    <p className="text-xs mt-1">No messages yet. Say hello!</p>
                  </div>
                )}

                {/* Messages with date separators */}
                {messages.map((msg, i) => {
                  const showDate = i === 0 || !sameDay(messages[i - 1].created_at, msg.created_at)
                  const isOwn = msg.user_id === currentUserId
                  const user = users.get(msg.user_id)

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="flex-1 h-px bg-ios-gray-5" />
                          <span className="text-xs text-ios-gray-3 font-medium shrink-0">
                            {formatDateLabel(msg.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-ios-gray-5" />
                        </div>
                      )}
                      <MessageBubble
                        msg={msg}
                        isOwn={isOwn}
                        user={user}
                        workspaceId={workspaceId}
                        channelId={activeChannel.id}
                        onPinned={handlePinned}
                      />
                    </React.Fragment>
                  )
                })}

                {/* Typing indicator */}
                {typingLabel && (
                  <div className="flex items-center gap-2 px-1 pb-1">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-ios-gray-3 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-ios-gray-3 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-ios-gray-3 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-ios-gray-3 italic">{typingLabel}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <MessageInput
                channelId={activeChannel.id}
                currentUserName={currentUserName}
                onSent={handleMessageSent}
                onFileUploaded={handleMessageSent}
              />
            </>
          )}
        </div>
      </div>

      {newChannelOpen && (
        <NewChannelModal
          workspaceId={workspaceId}
          onClose={() => setNewChannelOpen(false)}
          onCreated={(ch) => {
            setChannels(prev => [...prev, ch])
            setActiveChannel(ch)
            setNewChannelOpen(false)
          }}
        />
      )}
    </div>
  )
}
