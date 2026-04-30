import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AppRole = 'admin' | 'manager' | 'member' | 'viewer' | 'guest'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name?: string, role?: AppRole) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  isDev: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Dev mode fake user (when NO_AUTH=true on server)
const DEV_USER: User = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'dev@listflow.local',
  app_metadata: {},
  user_metadata: { name: 'Dev User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
}

const IS_DEV = import.meta.env.DEV || import.meta.env.VITE_API_URL?.includes('localhost')

// Sync auth user → listflow.app_users on every sign-in
async function syncUser(user: User, token: string, role?: AppRole) {
  try {
    const body: Record<string, unknown> = {
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
      avatar_url: user.user_metadata?.avatar_url ?? null,
    }
    if (role) body.role = role
    await fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    // Non-fatal — app still works without the app_users row
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(IS_DEV ? DEV_USER : null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!IS_DEV)

  useEffect(() => {
    if (IS_DEV) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user && data.session.access_token) {
        syncUser(data.session.user, data.session.access_token)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      if (sess?.user && sess.access_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        syncUser(sess.user, sess.access_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user && data.session?.access_token) {
      await syncUser(data.user, data.session.access_token)
    }
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string, name?: string, role?: AppRole) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name ?? email.split('@')[0] } },
    })
    if (!error && data.user && data.session?.access_token) {
      await syncUser(data.user, data.session.access_token, role)
    }
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, isDev: IS_DEV }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
