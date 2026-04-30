import type { Context, Next } from 'hono'
import { supabase } from '../db/client.js'

const NO_AUTH = process.env.NO_AUTH === 'true'

export interface AuthUser {
  id: string
  email?: string
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  if (NO_AUTH) {
    // Dev mode: use a fake user ID
    c.set('user', { id: '00000000-0000-0000-0000-000000000000', email: 'dev@listflow.local' })
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, 401)
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return c.json({ error: 'Unauthorized', code: 'INVALID_TOKEN' }, 401)
  }

  c.set('user', { id: data.user.id, email: data.user.email })
  await next()
}

export async function softAuth(c: Context, next: Next): Promise<void> {
  if (NO_AUTH) {
    c.set('user', { id: '00000000-0000-0000-0000-000000000000' })
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data } = await supabase.auth.getUser(token)
    if (data.user) {
      c.set('user', { id: data.user.id, email: data.user.email })
    }
  }
  await next()
}
