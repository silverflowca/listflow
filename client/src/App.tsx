import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

import { AuthPage } from '@/pages/AuthPage'
import { HomePage } from '@/pages/HomePage'
import { TasksView } from '@/pages/TasksView'
import { AudioView } from '@/pages/AudioView'
import { SettingsPage } from '@/pages/SettingsPage'
import { PageView } from '@/pages/PageView'
import { PagesListPage } from '@/pages/PagesListPage'
import { WorkspacePage } from '@/pages/WorkspacePage'
import { ChatView } from '@/pages/ChatView'

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected — all inside Layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<HomePage />} />
              <Route path="/tasks" element={<TasksView />} />
              <Route path="/chat" element={<ChatView />} />
              <Route path="/audio" element={<AudioView />} />
              <Route path="/pages" element={<PagesListPage />} />
              <Route path="/pages/:id" element={<PageView />} />
              <Route path="/workspace" element={<WorkspacePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/users" element={<Navigate to="/settings" replace />} />
              <Route path="/groups" element={<Navigate to="/settings" replace />} />
              <Route path="/admin/config" element={<Navigate to="/settings" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  )
}
