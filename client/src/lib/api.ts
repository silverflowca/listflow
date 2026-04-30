const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3016'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

const get = <T>(p: string) => req<T>('GET', p)
const post = <T>(p: string, b?: unknown) => req<T>('POST', p, b)
const patch = <T>(p: string, b: unknown) => req<T>('PATCH', p, b)
const del = <T = { ok: boolean }>(p: string) => req<T>('DELETE', p)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string; name: string; type: 'personal' | 'group'; owner_id: string
  icon?: string; description?: string; created_at: string; updated_at: string
}

export interface Page {
  id: string; workspace_id: string; parent_id?: string; title: string
  icon?: string; cover_url?: string; is_database: boolean; created_by: string
  position: number; created_at: string; updated_at: string
}

export interface Block {
  id: string; page_id: string; parent_block_id?: string
  type: 'text' | 'h1' | 'h2' | 'h3' | 'todo' | 'bullet' | 'numbered' | 'code' | 'divider' | 'image' | 'audio' | 'embed'
  content: Record<string, unknown>; position: number; created_at: string; updated_at: string
}

export interface Task {
  id: string; workspace_id: string; database_id?: string; title: string; description?: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignee_ids: string[]; parent_task_id?: string; due_date?: string; labels: string[]
  created_by: string; position: number; created_at: string; updated_at: string
  subtasks?: Subtask[]; comments?: Comment[]
}

export interface Subtask {
  id: string; task_id: string; title: string; completed: boolean; position: number; created_at: string
}

export interface Comment {
  id: string; task_id: string; user_id: string; content: string; created_at: string; updated_at: string
}

export interface Database {
  id: string; page_id: string; name: string; schema_def: SchemaColumn[]; created_at: string
}

export interface SchemaColumn {
  name: string; type: 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'email'
  options?: string[]
}

export interface Entry {
  id: string; database_id: string; workspace_id: string; properties: Record<string, unknown>
  created_by: string; created_at: string; updated_at: string
}

export interface AudioRecording {
  id: string; workspace_id: string; page_id?: string; task_id?: string
  filename: string; storage_path: string; duration_ms?: number; size_bytes?: number
  mime_type: string; created_by: string; created_at: string
  transcripts?: Transcript[]
}

export interface Transcript {
  id: string; recording_id: string; workspace_id: string; raw_text: string
  confidence_score: number; words: WordTiming[]; language: string; created_at: string
}

export interface WordTiming {
  word: string; start: number; end: number; confidence: number
}

export interface AgentRun {
  id: string; workspace_id: string; transcript_id?: string; prompt: string; response?: string
  tool_calls: ToolCall[]; tasks_created: string[]; iterations: number; total_tokens: number
  status: 'running' | 'done' | 'failed'; created_at: string; completed_at?: string
}

export interface ToolCall {
  toolName: string; input: Record<string, unknown>; ok: boolean; result: unknown; durationMs: number
}

export interface Setting {
  key: string; label: string; section: string; sensitive: boolean
  hasValue: boolean; source: 'override' | 'env' | 'none'; value: string
}

export type AppRole = 'admin' | 'manager' | 'member' | 'viewer' | 'guest'
export type UserStatus = 'active' | 'invited' | 'inactive' | 'suspended'

export interface AppUser {
  id: string; email: string; name: string; avatar_url?: string; initials: string
  color: string; role: AppRole; status: UserStatus
  last_seen_at?: string; invited_by?: string; created_at: string; updated_at: string
}

export interface UserGroup {
  id: string; name: string; description?: string; color: string; icon: string
  created_by: string; created_at: string; updated_at: string
  members?: GroupMember[]
}

export interface GroupMember {
  id: string; group_id: string; user_id: string; role: 'lead' | 'member'; joined_at: string
  user?: AppUser
}

export interface ConfigMatrixRow {
  id: string; feature: string; role: AppRole; enabled: boolean
  updated_by?: string; updated_at: string
}

// ── API modules ───────────────────────────────────────────────────────────────

export const workspaces = {
  list: () => get<{ workspaces: Workspace[] }>('/api/workspaces'),
  get: (id: string) => get<Workspace>(`/api/workspaces/${id}`),
  create: (b: { name: string; type?: string; icon?: string; description?: string }) => post<Workspace>('/api/workspaces', b),
  update: (id: string, b: Partial<Workspace>) => patch<Workspace>(`/api/workspaces/${id}`, b),
  delete: (id: string) => del(`/api/workspaces/${id}`),
  members: {
    list: (id: string) => get<{ members: { user_id: string; role: string; joined_at: string }[] }>(`/api/workspaces/${id}/members`),
    add: (id: string, b: { userId: string; role?: string }) => post(`/api/workspaces/${id}/members`, b),
    remove: (id: string, userId: string) => del(`/api/workspaces/${id}/members/${userId}`),
  },
}

export const pages = {
  list: (workspaceId: string) => get<{ pages: Page[] }>(`/api/pages?workspaceId=${workspaceId}`),
  get: (id: string) => get<Page>(`/api/pages/${id}`),
  create: (b: { workspaceId: string; title?: string; parentId?: string; icon?: string; isDatabase?: boolean }) => post<Page>('/api/pages', b),
  update: (id: string, b: Partial<Page>) => patch<Page>(`/api/pages/${id}`, b),
  delete: (id: string) => del(`/api/pages/${id}`),
}

export const blocks = {
  list: (pageId: string) => get<{ blocks: Block[] }>(`/api/blocks?pageId=${pageId}`),
  create: (b: { pageId: string; type: string; content?: Record<string, unknown>; position?: number }) => post<Block>('/api/blocks', b),
  update: (id: string, b: Partial<Block>) => patch<Block>(`/api/blocks/${id}`, b),
  delete: (id: string) => del(`/api/blocks/${id}`),
  reorder: (updates: { id: string; position: number }[]) => post('/api/blocks/reorder', { updates }),
}

export const tasks = {
  list: (params: { workspaceId: string; status?: string; priority?: string; databaseId?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)))
    return get<{ tasks: Task[] }>(`/api/tasks?${qs}`)
  },
  get: (id: string) => get<Task>(`/api/tasks/${id}`),
  create: (b: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'subtasks' | 'comments'> & { workspaceId: string }) => post<Task>('/api/tasks', b),
  update: (id: string, b: Partial<Task>) => patch<Task>(`/api/tasks/${id}`, b),
  delete: (id: string) => del(`/api/tasks/${id}`),
  subtasks: {
    create: (taskId: string, b: { title: string; position?: number }) => post<Subtask>(`/api/tasks/${taskId}/subtasks`, b),
    update: (taskId: string, sid: string, b: Partial<Subtask>) => patch<Subtask>(`/api/tasks/${taskId}/subtasks/${sid}`, b),
    delete: (taskId: string, sid: string) => del(`/api/tasks/${taskId}/subtasks/${sid}`),
  },
  comments: {
    create: (taskId: string, b: { content: string }) => post<Comment>(`/api/tasks/${taskId}/comments`, b),
    delete: (taskId: string, cid: string) => del(`/api/tasks/${taskId}/comments/${cid}`),
  },
}

export const databases = {
  list: (pageId?: string) => get<{ databases: Database[] }>(`/api/databases${pageId ? `?pageId=${pageId}` : ''}`),
  get: (id: string) => get<Database>(`/api/databases/${id}`),
  create: (b: { pageId: string; name?: string; schemaDef?: SchemaColumn[] }) => post<Database>('/api/databases', b),
  update: (id: string, b: { name?: string; schemaDef?: SchemaColumn[] }) => patch<Database>(`/api/databases/${id}`, b),
  delete: (id: string) => del(`/api/databases/${id}`),
  entries: {
    list: (dbId: string) => get<{ entries: Entry[] }>(`/api/databases/${dbId}/entries`),
    create: (dbId: string, b: { workspaceId: string; properties?: Record<string, unknown> }) => post<Entry>(`/api/databases/${dbId}/entries`, b),
    update: (dbId: string, eid: string, b: { properties: Record<string, unknown> }) => patch<Entry>(`/api/databases/${dbId}/entries/${eid}`, b),
    delete: (dbId: string, eid: string) => del(`/api/databases/${dbId}/entries/${eid}`),
  },
}

export const audio = {
  upload: (formData: FormData) => {
    const url = `${BASE}/api/audio/upload`
    return fetch(url, { method: 'POST', body: formData }).then(r => r.json()) as Promise<{
      recordingId: string; transcriptId: string | null; rawText: string; runId: string | null; error?: string
    }>
  },
  list: (workspaceId: string) => get<{ recordings: AudioRecording[] }>(`/api/audio?workspaceId=${workspaceId}`),
  listByTask: (taskId: string) => get<{ recordings: AudioRecording[] }>(`/api/audio/task/${taskId}`),
  delete: (id: string) => del(`/api/audio/${id}`),
}

export const agent = {
  run: (b: { workspaceId: string; prompt: string; transcriptId?: string }) => post<{ runId: string; status: string }>('/api/agent/run', b),
  runs: (workspaceId: string, limit?: number) => get<{ runs: AgentRun[] }>(`/api/agent/runs?workspaceId=${workspaceId}${limit ? `&limit=${limit}` : ''}`),
  getRun: (id: string) => get<AgentRun>(`/api/agent/runs/${id}`),
  memory: (workspaceId: string) => get<{ memory: { key: string; value: string }[] }>(`/api/agent/memory?workspaceId=${workspaceId}`),
}

export interface ModelOption { id: string; label: string; group: string }
export interface ModelsResponse { gemini: ModelOption[]; deepgram: ModelOption[] }

export const users = {
  list: () => get<{ users: AppUser[] }>('/api/users'),
  get: (id: string) => get<AppUser>(`/api/users/${id}`),
  create: (b: { id: string; email: string; name?: string; role?: AppRole; color?: string }) => post<AppUser>('/api/users', b),
  update: (id: string, b: Partial<Pick<AppUser, 'name' | 'role' | 'status' | 'avatar_url' | 'color'>>) => patch<AppUser>(`/api/users/${id}`, b),
  delete: (id: string) => del(`/api/users/${id}`),
  sync: (b: { id: string; email: string; name?: string }) => post<AppUser>('/api/users/sync', b),
}

export const groups = {
  list: () => get<{ groups: UserGroup[] }>('/api/groups'),
  get: (id: string) => get<UserGroup>(`/api/groups/${id}`),
  create: (b: { name: string; description?: string; color?: string; icon?: string; createdBy: string }) => post<UserGroup>('/api/groups', b),
  update: (id: string, b: { name?: string; description?: string; color?: string; icon?: string }) => patch<UserGroup>(`/api/groups/${id}`, b),
  delete: (id: string) => del(`/api/groups/${id}`),
  members: {
    add: (groupId: string, b: { userId: string; role?: string }) => post<GroupMember>(`/api/groups/${groupId}/members`, b),
    remove: (groupId: string, userId: string) => del(`/api/groups/${groupId}/members/${userId}`),
    updateRole: (groupId: string, userId: string, role: string) => patch<GroupMember>(`/api/groups/${groupId}/members/${userId}`, { role }),
  },
}

export const configMatrix = {
  list: () => get<{ matrix: ConfigMatrixRow[] }>('/api/admin/config'),
  upsert: (b: { feature: string; role: AppRole; enabled: boolean; updatedBy?: string }) => req<ConfigMatrixRow>('PUT', '/api/admin/config', b),
  bulkUpsert: (rows: { feature: string; role: AppRole; enabled: boolean }[]) =>
    req<{ matrix: ConfigMatrixRow[] }>('PUT', '/api/admin/config/bulk', { rows }),
}

export const settings = {
  list: () => get<{ settings: Setting[] }>('/api/settings'),
  update: (key: string, value: string) => patch<Setting>(`/api/settings/${key}`, { value }),
  delete: (key: string) => del<Setting>(`/api/settings/${key}`),
  status: () => get<{ ai: { anthropic: boolean; gemini: boolean; activeProvider: string }; stt: { deepgram: boolean }; fileflow: { configured: boolean; url: string | null } }>('/api/settings/status'),
  models: () => get<ModelsResponse>('/api/settings/models'),
  testFileFlow: (url: string, email: string, password: string) =>
    post<{ ok: boolean; error?: string }>('/api/settings/fileflow/test', { url, email, password }),
}
