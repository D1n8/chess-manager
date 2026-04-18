import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'
import './PlayerDashboard.css'

export default function PlayerDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('tournaments').select('*').then(({ data }) => setTournaments(data || []))
  }, [])

  const handleApply = async (tId: string) => {
    const user: AppUser = JSON.parse(localStorage.getItem('user')!)
    const { error } = await supabase.from('participants').insert([{ tournament_id: tId, player_id: user.id }])
    if (error) alert('Вы уже подали заявку на этот турнир!')
    else alert('Заявка отправлена на рассмотрение организатору.')
  }

  return (
    <div className="container">
      <h2>Поиск турниров</h2>
      <div className="grid">
        {tournaments.map(t => (
          <div key={t.id} className="card">
            <h3>{t.title}</h3>
            <p><strong>Город:</strong> {t.city}</p>
            <p><strong>Формат:</strong> {t.time_control}</p>
            <p><strong>Начало:</strong> {t.start_date} в {t.start_time}</p>
            <p><strong>Места:</strong> {t.total_spots}</p>
            <div className="card-actions">
              <button className="btn-primary" onClick={() => handleApply(t.id)}>Подать заявку</button>
              <button className="btn-primary" style={{backgroundColor: '#000'}} onClick={() => navigate(`/tournaments/${t.id}`)}>Сетка</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}