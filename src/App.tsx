import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import PlayerDashboard from './pages/PlayerDashboard'
import PlayerTournament from './pages/PlayerTournament'
import OrganizerDashboard from './pages/OrganizerDashboard'
import OrganizerManage from './pages/OrganizerManage'
import ProfilePage from './pages/ProfilePage'
import Layout from './components/Layout'
import type { AppUser } from './types'
import './App.css'

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  if (!user) {
    return <AuthPage onAuth={(u) => {
      localStorage.setItem('user', JSON.stringify(u))
      setUser(u)
    }} />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {user.role === 'player' && (
          <>
            <Route path="/tournaments" element={<PlayerDashboard />} />
            <Route path="/tournaments/:id" element={<PlayerTournament />} />
            <Route path="*" element={<Navigate to="/tournaments" />} />
          </>
        )}

        {user.role === 'organizer' && (
          <>
            <Route path="/admin" element={<OrganizerDashboard />} />
            <Route path="/admin/manage/:id" element={<OrganizerManage />} />
            <Route path="*" element={<Navigate to="/admin" />} />
          </>
        )}
        
        <Route path="/profile" element={<ProfilePage onLogout={() => setUser(null)} />} />
      </Route>
    </Routes>
  )
}