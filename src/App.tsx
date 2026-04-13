import { useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import PlayerDashboard from './pages/PlayerDashboard'
import PlayerTournament from './pages/PlayerTournament'
import OrganizerDashboard from './pages/OrganizerDashboard'
import OrganizerManage from './pages/OrganizerManage'
import type { AppUser } from './types'

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    navigate('/')
  }

  if (!user) {
    return <AuthPage onAuth={(u) => {
      localStorage.setItem('user', JSON.stringify(u))
      setUser(u)
    }} />
  }

  return (
    <div>
      <header>
        <span>Пользователь: {user.email} (Роль: {user.role})</span>
        <button onClick={handleLogout}>Выйти</button>
      </header>
      
      <main>
        <Routes>
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
        </Routes>
      </main>
    </div>
  )
}