import { useState, type FormEvent } from 'react'
import { supabase } from '../../supabaseClient'
import type { AppUser } from '../../types'
import { useToast } from '../../components/ToastContext'
import './AuthPage.css'

export default function AuthPage({ onAuth }: { onAuth: (user: AppUser) => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('player')
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [rating, setRating] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const { showToast } = useToast()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (isLogin) {
      const { data } = await supabase.from('app_users').select('*').eq('email', email).eq('password', password).single()
      if (data) {
        showToast('Успешный вход!')
        onAuth(data)
      } else {
        showToast('Неверный email или пароль', 'error')
      }
    } else {
      const payload: any = { email, password, role, full_name: fullName }
      if (role === 'player') {
        payload.age = parseInt(age)
        payload.rating = parseInt(rating)
      }
      const { data, error } = await supabase.from('app_users').insert([payload]).select('*').single()
      
      if (error) {
        showToast('Ошибка: возможно email уже занят', 'error')
      } else if (data) {
        showToast('Аккаунт успешно создан!')
        onAuth(data)
      }
    }
    setIsLoading(false)
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1>{isLogin ? 'Вход в систему' : 'Регистрация'}</h1>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required minLength={4} />
          
          {!isLogin && (
            <>
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="player">Я Игрок</option>
                <option value="organizer">Я Организатор</option>
              </select>
              <input type="text" placeholder="ФИО" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={3} />
              
              {role === 'player' && (
                <>
                  <input type="number" placeholder="Возраст (5-100)" value={age} onChange={e => setAge(e.target.value)} required min="5" max="100" />
                  <input type="number" placeholder="Рейтинг (0-3000)" value={rating} onChange={e => setRating(e.target.value)} required min="0" max="3000" />
                </>
              )}
            </>
          )}

          <button type="submit" className="btn-primary" style={{width: '100%'}} disabled={isLoading}>
            {isLoading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Создать аккаунт')}
          </button>
        </form>
        <button className="toggle-btn" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  )
}