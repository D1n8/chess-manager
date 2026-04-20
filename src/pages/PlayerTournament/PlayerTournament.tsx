import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, Match, AppUser } from '../../types'

export default function PlayerTournament() {
  const { id } = useParams()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [roundTab, setRoundTab] = useState<number>(1)
  const [userFullName, setUserFullName] = useState('')

  useEffect(() => {
    const user: AppUser = JSON.parse(localStorage.getItem('user')!)
    setUserFullName(user.full_name || '')
    if (id) fetchData()
  }, [id])

  const fetchData = async () => {
    const { data: tData } = await supabase.from('tournaments').select('*').eq('id', id).single()
    const { data: mData } = await supabase.from('matches')
      .select('*, white_user:app_users!player_white_id(full_name), black_user:app_users!player_black_id(full_name)')
      .eq('tournament_id', id)
    
    setTournament(tData)
    setMatches(mData || [])
    if (mData && mData.length > 0) {
      setRoundTab(Math.max(...mData.map(m => m.round_number)))
    }
  }

  const roundTabsArray = Array.from({length: Math.max(...matches.map(m=>m.round_number), 1)}, (_, i) => i + 1)
  const isTournamentFinished = tournament && Math.max(...matches.map(m=>m.round_number)) >= tournament.total_rounds && matches.every(m => m.result !== null)

  // Подсчет итогов
  const getStandings = () => {
    const scores: Record<string, number> = {}
    matches.forEach(m => {
      const w = m.white_user?.full_name || 'Неизвестно'
      const b = m.black_user?.full_name || 'Неизвестно'
      if (!scores[w]) scores[w] = 0
      if (m.player_black_id && !scores[b]) scores[b] = 0
      
      if (m.result === '1-0') scores[w] += 1
      if (m.result === '0-1') scores[b] += 1
      if (m.result === '0.5-0.5') { scores[w] += 0.5; scores[b] += 0.5; }
    })
    return Object.entries(scores).sort((a,b) => b[1] - a[1]) // Сортировка по очкам
  }

  return (
    <div className="container">
      <h1 style={{color: '#660000', marginBottom: 20}}>{tournament?.title}</h1>
      
      <div className="tabs">
        {roundTabsArray.map(r => (
          <button key={r} className={`tab-btn ${roundTab === r ? 'active' : ''}`} onClick={() => setRoundTab(r)}>Тур {r}</button>
        ))}
        {isTournamentFinished && (
          <button className={`tab-btn ${roundTab === 999 ? 'active' : ''}`} style={{backgroundColor: '#2e8b57', color: '#fff'}} onClick={() => setRoundTab(999)}>Итоги</button>
        )}
      </div>

      {roundTab !== 999 ? (
        <table>
          <thead><tr><th>Стол</th><th>Белые</th><th>Черные</th><th>Результат</th></tr></thead>
          <tbody>
            {matches.filter(m => m.round_number === roundTab).sort((a,b) => a.table_number - b.table_number).map(m => {
              const isMe = m.white_user?.full_name === userFullName || m.black_user?.full_name === userFullName
              return (
                <tr key={m.id} style={{ backgroundColor: isMe ? '#ffcccc' : '' }}>
                  <td>{m.player_black_id ? m.table_number : 'Авто'}</td>
                  <td style={{fontWeight: m.white_user?.full_name === userFullName ? 'bold' : 'normal'}}>{m.white_user?.full_name}</td>
                  <td style={{fontWeight: m.black_user?.full_name === userFullName ? 'bold' : 'normal'}}>{m.player_black_id ? m.black_user?.full_name : <i>Пропуск тура</i>}</td>
                  <td>{m.result || 'Ожидается'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div>
          <h2 style={{color: '#2e8b57', marginBottom: 15}}>Финальная таблица результатов</h2>
          <table>
            <thead><tr><th>Место</th><th>Игрок</th><th>Очки</th></tr></thead>
            <tbody>
              {getStandings().map(([name, score], index) => (
                <tr key={name} style={{ backgroundColor: name === userFullName ? '#ffcccc' : '' }}>
                  <td>{index + 1}</td>
                  <td style={{fontWeight: name === userFullName ? 'bold' : 'normal'}}>{name}</td>
                  <td><strong>{score}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}