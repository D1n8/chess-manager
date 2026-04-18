import { Outlet, Link, useNavigate } from 'react-router-dom'
import type { AppUser } from '../types'

export default function Layout() {
  const navigate = useNavigate()
  const userString = localStorage.getItem('user')
  const user: AppUser | null = userString ? JSON.parse(userString) : null

  const getDashboardLink = () => {
    if (user?.role === 'organizer') return '/admin'
    return '/tournaments'
  }

  return (
    <div>
      <header className="header">
        <div className="header-left">
          <div className="logo">ChessManager</div>
          <nav className="nav-links">
            <Link to={getDashboardLink()}>Турниры</Link>
            <Link to="#">Мировой рейтинг</Link>
          </nav>
        </div>
        <button className="btn-profile" onClick={() => navigate('/profile')}>
          Личный кабинет
        </button>
      </header>
      
      <main>
        <Outlet />
      </main>
    </div>
  )
}