import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, Match, Participant } from '../../types'

export default function PlayerTournament() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])

  const [tab, setTab] = useState<'participants' | 'matches' | 'standings'>('participants')
  const [activeRound, setActiveRound] = useState<number>(1)

  const fetchData = async (tournamentId: string) => {
    const { data: tData } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
    // Загружаем только подтвержденных участников
    const { data: pData } = await supabase.from('participants').select('*, app_users(full_name, rating)').eq('tournament_id', tournamentId).eq('status', 'confirmed')
    const { data: mData } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId)

    if (tData) setTournament(tData as Tournament)
    if (pData) setParticipants(pData as Participant[])

    if (mData && mData.length > 0) {
      setMatches(mData as Match[])
      const maxR = Math.max(...mData.map((m: Match) => m.round_number))
      setActiveRound(maxR)
      setTab('matches') // Если турнир начался, сразу открываем жеребьевку
    }
  }

  useEffect(() => {
    if (id) fetchData(id)
  }, [id])

  const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : 0
  const isTournamentStarted = currentRound > 0

  // Функция для поиска ФИО по ID (для вкладки жеребьевки)
  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return 'Пропуск тура (Bye)'
    const p = participants.find(part => part.player_id === playerId)
    return p?.app_users?.full_name || 'Неизвестный игрок'
  }

  // Подсчет очков для итоговой таблицы
  const getStandings = () => {
    const scores: Record<string, { name: string, points: number, rating: number }> = {}

    participants.forEach(p => {
      scores[p.player_id] = {
        name: p.app_users?.full_name || 'Неизвестно',
        points: 0,
        rating: p.app_users?.rating || 0
      }
    })

    matches.forEach(m => {
      if (!m.result) return
      if (m.player_white_id && scores[m.player_white_id]) {
        if (m.result === '1-0') scores[m.player_white_id].points += 1
        if (m.result === '0.5-0.5') scores[m.player_white_id].points += 0.5
      }
      if (m.player_black_id && scores[m.player_black_id]) {
        if (m.result === '0-1') scores[m.player_black_id].points += 1
        if (m.result === '0.5-0.5') scores[m.player_black_id].points += 0.5
      }
    })

    return Object.values(scores).sort((a, b) => b.points - a.points || b.rating - a.rating)
  }

  if (!tournament) return <div className="container">Загрузка...</div>

  return (
    <div className="container">
      <h1 style={{ color: '#660000', marginBottom: '10px' }}>{tournament.title}</h1>
      <p style={{ marginBottom: '20px', color: '#555' }}>
        {tournament.city} • {tournament.time_control} • {new Date(tournament.start_datetime).toLocaleDateString('ru-RU')}
      </p>

      {/* Вкладки отображаются по условию */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'participants' ? 'active' : ''}`} onClick={() => setTab('participants')}>Участники</button>
        {isTournamentStarted && (
          <>
            <button className={`tab-btn ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Жеребьевка</button>
            <button className={`tab-btn ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Турнирная таблица</button>
          </>
        )}
      </div>

      {/* Вкладка: Список участников */}
      {tab === 'participants' && (
        <div>
          <h2 style={{ color: '#660000', marginBottom: '15px' }}>Список участников</h2>
          {!isTournamentStarted && <p style={{ color: 'gray', marginBottom: '15px' }}>Турнир еще не начался. Ожидайте жеребьевки 1 тура.</p>}
          <table>
            <thead>
              <tr><th>№</th><th>ФИО</th><th>Рейтинг</th></tr>
            </thead>
            <tbody>
              {participants.sort((a, b) => (b.app_users?.rating || 0) - (a.app_users?.rating || 0)).map((p, index) => (
                <tr key={p.id}>
                  <td width="50">{index + 1}</td>
                  <td>{p.app_users?.full_name}</td>
                  <td>{p.app_users?.rating}</td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center' }}>Пока нет подтвержденных участников</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Вкладка: Жеребьевка (только для чтения) */}
      {tab === 'matches' && isTournamentStarted && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[...Array(currentRound)].map((_, i) => {
              const r = i + 1;
              const isActive = activeRound === r;
              return (
                <button
                  key={r}
                  onClick={() => setActiveRound(r)}
                  style={{
                    padding: '8px 16px',
                    border: isActive ? 'none' : '1px solid #ccc',
                    backgroundColor: isActive ? '#660000' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#000000',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: isActive ? 'bold' : 'normal'
                  }}
                >
                  Тур {r}
                </button>
              )
            })}
          </div>

          <h3 style={{ color: '#660000', marginBottom: 10 }}>Результаты: Тур {activeRound}</h3>
          <table>
            <thead><tr><th>Стол</th><th>Белые</th><th>Черные</th><th>Счет</th></tr></thead>
            <tbody>
              {matches
                .filter(m => m.round_number === activeRound)
                .sort((a, b) => a.table_number - b.table_number)
                .map(m => (
                  <tr key={m.id}>
                    <td width="50">{m.table_number}</td>
                    <td width="35%">{getPlayerName(m.player_white_id)}</td>
                    <td width="35%">{getPlayerName(m.player_black_id)}</td>
                    <td>
                      <strong>
                        {m.result === '1-0' ? '1 - 0' :
                          m.result === '0-1' ? '0 - 1' :
                            m.result === '0.5-0.5' ? '½ - ½' : 'Ожидается'}
                      </strong>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Вкладка: Турнирная таблица (только для чтения) */}
      {tab === 'standings' && isTournamentStarted && (
        <div>
          <h2 style={{ color: '#660000', marginBottom: 15 }}>Текущее положение</h2>
          <table>
            <thead><tr><th>Место</th><th>ФИО</th><th>Рейтинг</th><th>Очки</th></tr></thead>
            <tbody>
              {getStandings().map((p, index) => (
                <tr key={p.name}>
                  <td width="50">{index + 1}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.rating}</td>
                  <td><strong style={{ color: '#660000', fontSize: '18px' }}>{p.points}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}