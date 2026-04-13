import { useState  } from 'react'
import { supabase } from '../../supabaseClient'
import type { AppUser } from '../../types'

interface AuthPageProps {
  onAuth: (user: AppUser) => void
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true)
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [role, setRole] = useState<string>('player')

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (isLogin) {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, email, role')
        .eq('email', email)
        .eq('password', password)
        .single()

      if (error || !data) {
        alert('Неверный email или пароль')
      } else {
        onAuth(data as AppUser)
      }
    } else {
      const { data, error } = await supabase
        .from('app_users')
        .insert([{ email, password, role }])
        .select('id, email, role')
        .single()

      if (error) {
        alert('Ошибка регистрации: ' + error.message)
      } else if (data) {
        onAuth(data as AppUser)
      }
    }
  }

  return (
    <div>
      <h1>{isLogin ? 'Вход' : 'Регистрация'}</h1>
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Пароль" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        
        {!isLogin && (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="player">Игрок</option>
            <option value="organizer">Организатор</option>
          </select>
        )}

        <button type="submit">{isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
      </button>
    </div>
  )
}