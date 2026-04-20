import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'
import './PlayerDashboard.css'

export default function PlayerDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [appliedTournamentIds, setAppliedTournamentIds] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    const fetchDash = async () => {
      const user: AppUser = JSON.parse(localStorage.getItem('user')!)
      const { data: tData } = await supabase.from('tournaments').select('*')
      const { data: pData } = await supabase.from('participants').select('tournament_id').eq('player_id', user.id)

      setTournaments(tData || [])
      if (pData) setAppliedTournamentIds(new Set(pData.map(p => p.tournament_id)))
    }
    fetchDash()
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
            <p><strong>Начало:</strong> {t.start_date} в {t.start_date}</p>
            <p><strong>Места:</strong> {t.total_spots}</p>
            <div className="card-actions">
              {!appliedTournamentIds.has(t.id) ? (
                <button className="btn-primary" onClick={() => handleApply(t.id)}>Подать заявку</button>
              ) : (
                <span style={{ color: '#2e8b57', fontWeight: 'bold' }}>Вы в списке</span>
              )}
              <button className="btn-primary" style={{ backgroundColor: '#000' }} onClick={() => navigate(`/tournaments/${t.id}`)}>Сетка</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}