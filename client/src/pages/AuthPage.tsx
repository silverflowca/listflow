import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CheckSquare, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'
type Role = 'admin' | 'manager' | 'member' | 'viewer' | 'guest'

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'admin',   label: 'Admin',   desc: 'Full access — manage users, settings, all content' },
  { value: 'manager', label: 'Manager', desc: 'Create & edit content, manage groups' },
  { value: 'member',  label: 'Member',  desc: 'Create tasks, pages, record audio' },
  { value: 'viewer',  label: 'Viewer',  desc: 'Read-only access to content' },
  { value: 'guest',   label: 'Guest',   desc: 'Limited read access, no audio or tasks' },
]

export function AuthPage() {
  const { user, loading, signIn, signUp, isDev } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Already authenticated
  if (!loading && (user || isDev)) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    if (mode === 'login') {
      const { error: err } = await signIn(email, password)
      if (err) setError(err.message)
    } else {
      const { error: err } = await signUp(email, password, name, role)
      if (err) {
        setError(err.message)
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('login')
      }
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-bg">
        <div className="w-8 h-8 border-2 border-ios-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ios-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-ios-blue rounded-ios-lg flex items-center justify-center shadow-ios-md mb-3">
            <CheckSquare size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ios-label">ListFlow</h1>
          <p className="text-sm text-ios-gray-1 mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-ios-xl shadow-ios-lg border border-ios-gray-5 overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-ios-gray-5">
            <button
              onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
              className={cn(
                'flex-1 py-3.5 text-sm font-medium transition-colors',
                mode === 'login'
                  ? 'text-ios-blue border-b-2 border-ios-blue bg-blue-50/40'
                  : 'text-ios-gray-1 hover:text-ios-label',
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); setSuccess(null) }}
              className={cn(
                'flex-1 py-3.5 text-sm font-medium transition-colors',
                mode === 'register'
                  ? 'text-ios-blue border-b-2 border-ios-blue bg-blue-50/40'
                  : 'text-ios-gray-1 hover:text-ios-label',
              )}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            {/* Error / success banners */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-ios text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-200 rounded-ios text-sm text-green-700">
                <CheckSquare size={16} className="shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Name (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-ios-label mb-1.5">Full name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ios-gray-2" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-ios-gray-6 border border-ios-gray-4 rounded-ios text-sm text-ios-label placeholder:text-ios-gray-3 focus:outline-none focus:ring-2 focus:ring-ios-blue focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-ios-label mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ios-gray-2" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-ios-gray-6 border border-ios-gray-4 rounded-ios text-sm text-ios-label placeholder:text-ios-gray-3 focus:outline-none focus:ring-2 focus:ring-ios-blue focus:border-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-ios-label mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ios-gray-2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
                  required
                  minLength={6}
                  className="w-full pl-9 pr-10 py-2.5 bg-ios-gray-6 border border-ios-gray-4 rounded-ios text-sm text-ios-label placeholder:text-ios-gray-3 focus:outline-none focus:ring-2 focus:ring-ios-blue focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-2 hover:text-ios-gray-1"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Role selection (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-ios-label mb-2">Role</label>
                <div className="space-y-1.5">
                  {ROLES.map(r => (
                    <label
                      key={r.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-ios border cursor-pointer transition-colors',
                        role === r.value
                          ? 'border-ios-blue bg-blue-50/60'
                          : 'border-ios-gray-4 hover:bg-ios-gray-6',
                      )}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={() => setRole(r.value)}
                        className="mt-0.5 accent-ios-blue"
                      />
                      <div>
                        <div className="text-sm font-medium text-ios-label">{r.label}</div>
                        <div className="text-xs text-ios-gray-1 leading-relaxed">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-ios-blue hover:bg-blue-600 disabled:opacity-60 text-white font-semibold rounded-ios text-sm transition-colors shadow-ios"
            >
              {submitting
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>

            {/* Switch mode link */}
            <p className="text-center text-xs text-ios-gray-1">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setSuccess(null) }}
                className="text-ios-blue font-medium hover:underline"
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-ios-gray-2 mt-6">
          ListFlow · Workspace notes, tasks & audio in one place
        </p>
      </div>
    </div>
  )
}
