import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDev } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-bg">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ws-spinner" style={{ borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!user && !isDev) return <Navigate to="/auth" replace />

  return <>{children}</>
}
