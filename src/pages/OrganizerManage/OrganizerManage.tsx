import { useEffect, useState, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Participant, Match, AppUser, Tournament } from '../../types'
import './OrganizerManage.css'

export default function OrganizerManage() {
  const { id } = useParams()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])   
  const [matches, setMatches] = useState<Match[]>([])
  const [tab, setTab] = useState<'participants' | 'matches' | 'standings'>('participants')
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [foundPlayers, setFoundPlayers] = useState<AppUser[]>([])
  const [newPlayer, setNewPlayer] = useState({ full_name: '', email: '', age: '', rating: '' })
  const [generatedCredentials, setGeneratedCredentials] = useState<{email: string, password: string} | null>(null)

  useEffect(() => { if(id) fetchData() }, [id])

  const fetchData = async () => {
    const { data: tData } = await supabase.from('tournaments').select('*').eq('id', id).single()
    const { data: pData } = await supabase.from('participants').select('*, app_users(full_name, rating)').eq('tournament_id', id)
    const { data: mData } = await supabase.from('matches').select('*').eq('tournament_id', id)
    
    if (tData) setTournament(tData)
    setParticipants(pData || [])
    setMatches(mData || [])
  }

  // Вспомогательная функция: получаем ФИО по ID из загруженных участников
  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return 'Нет (Пропуск тура)'
    const p = participants.find(p => p.player_id === playerId)
    return p?.app_users?.full_name || 'Неизвестно'
  }

  // --- Логика Швейцарской системы ---
  
  // 1. Подсчет очков по ID игроков
  const getStandings = () => {
    const scores: Record<string, { id: string, name: string, points: number, rating: number }> = {}
    
    // Инициализация (чтобы в таблице были даже те, кто еще не играл)
    participants.filter(p => p.status === 'confirmed').forEach(p => {
      scores[p.player_id] = { 
        id: p.player_id, 
        name: p.app_users?.full_name || 'Неизвестно',
        points: 0, 
        rating: p.app_users?.rating || 0 
      }
    })

    // Начисление очков по матчам
    matches.forEach(m => {
      if (!m.result) return

      // Страховка, если игрока удалили
      if (!scores[m.player_white_id]) scores[m.player_white_id] = { id: m.player_white_id, name: getPlayerName(m.player_white_id), points: 0, rating: 0 }
      if (m.player_black_id && !scores[m.player_black_id]) scores[m.player_black_id] = { id: m.player_black_id, name: getPlayerName(m.player_black_id), points: 0, rating: 0 }

      if (m.result === '1-0') {
        scores[m.player_white_id].points += 1
      }
      if (m.result === '0-1' && m.player_black_id) {
        scores[m.player_black_id].points += 1
      }
      if (m.result === '0.5-0.5') {
        scores[m.player_white_id].points += 0.5
        if (m.player_black_id) scores[m.player_black_id].points += 0.5
      }
    })

    // Преобразуем в массив и сортируем (сначала очки, затем рейтинг)
    return Object.values(scores).sort((a, b) => b.points - a.points || b.rating - a.rating)
  }

  // 2. Генерация тура (спариваем по ID)
  const generateRound = async () => {
    if (!tournament) return
    const standings = getStandings()
    
    if (standings.length < 2) {
      alert('Недостаточно подтвержденных участников (минимум 2)')
      return
    }

    const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : 0
    const nextRound = currentRound + 1

    const newMatches = []
    let table = 1

    for (let i = 0; i < standings.length - 1; i += 2) {
      newMatches.push({
        tournament_id: id, 
        round_number: nextRound, 
        table_number: table++,
        player_white_id: standings[i].id, 
        player_black_id: standings[i + 1].id,
        result: null
      })
    }
    
    await supabase.from('matches').insert(newMatches)
    fetchData()
  }

  // Статусы турнира
  const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : 0
  const matchesOfCurrentRound = matches.filter(m => m.round_number === currentRound)
  const allResultsEntered = matchesOfCurrentRound.length > 0 && matchesOfCurrentRound.every(m => m.result && m.result !== '')
  const isTournamentFinished = tournament && currentRound === tournament.total_rounds && allResultsEntered

  // --- Управление ---
  const confirmPlayer = async (pId: string) => {
    await supabase.from('participants').update({ status: 'confirmed' }).eq('id', pId)
    fetchData()
  }

  const removePlayer = async (pId: string) => {
    if (window.confirm('Вы уверены?')) {
      await supabase.from('participants').delete().eq('id', pId)
      fetchData()
    }
  }

  const handleSearch = async () => {
    const { data } = await supabase.from('app_users').select('*').eq('role', 'player').ilike('full_name', `%${searchQuery}%`)
    setFoundPlayers(data || [])
  }

  const addExistingPlayer = async (playerId: string) => {
    const { error } = await supabase.from('participants').insert([{ tournament_id: id, player_id: playerId, status: 'confirmed' }])
    if (error) alert('Игрок уже в турнире')
    else { fetchData(); closeModal() }
  }

  const handleCreateNewPlayer = async (e: FormEvent) => {
    e.preventDefault()
    const password = Math.random().toString(36).slice(-8)

    const { data: user, error: userError } = await supabase.from('app_users').insert([{
      email: newPlayer.email, password: password, role: 'player',
      full_name: newPlayer.full_name, age: parseInt(newPlayer.age), rating: parseInt(newPlayer.rating)
    }]).select().single()

    if (userError) { alert('Ошибка: возможно email уже занят'); return }
    if (user) {
      await supabase.from('participants').insert([{ tournament_id: id, player_id: user.id, status: 'confirmed' }])
      setGeneratedCredentials({ email: newPlayer.email, password: password })
      setNewPlayer({ full_name: '', email: '', age: '', rating: '' })
      fetchData()
    }
  }

  const updateResult = async (mId: string, result: string) => {
    await supabase.from('matches').update({ result: result === '' ? null : result }).eq('id', mId)
    fetchData()
  }

  const closeModal = () => {
    setShowAddModal(false); setGeneratedCredentials(null); setSearchQuery(''); setFoundPlayers([])
  }

  if (!tournament) return <div className="container">Загрузка...</div>

  return (
    <div className="container">
      <div className="tabs">
        <button className={`tab-btn ${tab === 'participants' ? 'active' : ''}`} onClick={() => setTab('participants')}>Участники</button>
        <button className={`tab-btn ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Жеребьевка</button>
        <button className={`tab-btn ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Итоговая таблица</button>
      </div>

      {tab === 'participants' && (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{color: '#660000'}}>Управление участниками</h2>
            {currentRound === 0 && <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Добавить участника</button>}
          </div>
          {currentRound > 0 && <p style={{color: 'gray', marginTop: 10}}>* Регистрация закрыта, турнир начался.</p>}
          <table>
            <thead><tr><th>ФИО</th><th>Рейтинг</th><th>Статус</th><th>Действия</th></tr></thead>
            <tbody>
              {participants.map(p => (
                <tr key={p.id}>
                  <td>{p.app_users?.full_name}</td><td>{p.app_users?.rating}</td>
                  <td><span className={`badge ${p.status === 'pending' ? 'bg-pending' : 'bg-confirmed'}`}>{p.status === 'pending' ? 'Ожидает' : 'Принят'}</span></td>
                  <td className="actions-cell">
                    {p.status === 'pending' && currentRound === 0 && <button className="btn-success" onClick={() => confirmPlayer(p.id)}>Принять</button>}
                    {currentRound === 0 && <button className="btn-danger" onClick={() => removePlayer(p.id)}>{p.status === 'pending' ? 'Отклонить' : 'Удалить'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'matches' && (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 20}}>
            <h2 style={{color: '#660000'}}>Матчи и результаты</h2>
            {currentRound === 0 && <button className="btn-primary" onClick={generateRound}>Сгенерировать 1 тур</button>}
            {currentRound > 0 && currentRound < tournament.total_rounds && allResultsEntered && <button className="btn-primary" onClick={generateRound}>Сгенерировать {currentRound + 1} тур</button>}
            {currentRound > 0 && currentRound < tournament.total_rounds && !allResultsEntered && <button className="btn-primary" style={{backgroundColor: 'gray', cursor: 'not-allowed'}} disabled>Ожидаем результаты {currentRound} тура</button>}
            {isTournamentFinished && <button className="btn-success" onClick={() => setTab('standings')}>Показать итоги</button>}
          </div>

          {[...Array(currentRound)].map((_, i) => {
            const roundNumber = currentRound - i
            const roundMatches = matches.filter(m => m.round_number === roundNumber).sort((a,b) => a.table_number - b.table_number)
            
            return (
              <div key={roundNumber} style={{marginBottom: 30}}>
                <h3 style={{color: '#660000', marginBottom: 10}}>Тур {roundNumber}</h3>
                <table>
                  <thead><tr><th>Стол</th><th>Белые</th><th>Черные</th><th>Счет</th></tr></thead>
                  <tbody>
                    {roundMatches.map(m => (
                      <tr key={m.id}>
                        <td width="50">{m.table_number}</td>
                        {/* ЗДЕСЬ ИСПОЛЬЗУЕТСЯ НОВАЯ ФУНКЦИЯ ДЛЯ ВЫВОДА ФИО */}
                        <td width="35%">{getPlayerName(m.player_white_id)}</td>
                        <td width="35%">{getPlayerName(m.player_black_id)}</td>
                        <td>
                          <select value={m.result || ''} onChange={(e) => updateResult(m.id, e.target.value)} disabled={roundNumber !== currentRound}>
                            <option value="">Ожидается...</option>
                            <option value="1-0">1-0</option>
                            <option value="0-1">0-1</option>
                            <option value="0.5-0.5">Ничья</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'standings' && (
        <div>
          <h2 style={{color: '#660000', marginBottom: 15}}>{isTournamentFinished ? 'Финальная таблица' : 'Текущее положение (Live)'}</h2>
          <table>
            <thead><tr><th>Место</th><th>ФИО</th><th>Рейтинг</th><th>Очки</th></tr></thead>
            <tbody>
              {getStandings().map((p, index) => (
                <tr key={p.id}>
                  <td>{index + 1}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.rating}</td>
                  <td><strong style={{color: '#660000', fontSize: '18px'}}>{p.points}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка добаления участника */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 20}}>
              <h3 style={{color: '#660000'}}>Добавить участника</h3>
              <button onClick={closeModal} style={{background: 'none', border: 'none', fontSize: 20, cursor: 'pointer'}}>×</button>
            </div>
            {generatedCredentials ? (
              <div style={{backgroundColor: '#e6ffe6', padding: '15px', borderRadius: '4px', marginBottom: '20px', border: '1px solid #2e8b57'}}>
                <h4 style={{color: '#2e8b57', marginBottom: '10px'}}>Успех! Передайте данные игроку:</h4>
                <p>Логин: {generatedCredentials.email}</p>
                <p>Пароль: {generatedCredentials.password}</p>
                <button className="btn-primary" style={{marginTop: '15px', width: '100%'}} onClick={() => setGeneratedCredentials(null)}>Дальше</button>
              </div>
            ) : (
              <>
                <div className="search-box">
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по ФИО..."/>
                  <button className="btn-primary" onClick={handleSearch}>Найти</button>
                </div>
                <div>
                  {foundPlayers.map(fp => (
                    <div key={fp.id} className="search-result-item">
                      <span>{fp.full_name} ({fp.rating})</span>
                      <button className="btn-success" onClick={() => addExistingPlayer(fp.id)}>Добавить</button>
                    </div>
                  ))}
                </div>
                <div className="divider"></div>
                <form onSubmit={handleCreateNewPlayer}>
                  <input placeholder="ФИО" value={newPlayer.full_name} onChange={e => setNewPlayer({...newPlayer, full_name: e.target.value})} required/>
                  <input type="email" placeholder="Email" value={newPlayer.email} onChange={e => setNewPlayer({...newPlayer, email: e.target.value})} required/>
                  <input type="number" placeholder="Возраст" value={newPlayer.age} onChange={e => setNewPlayer({...newPlayer, age: e.target.value})} required/>
                  <input type="number" placeholder="Рейтинг" value={newPlayer.rating} onChange={e => setNewPlayer({...newPlayer, rating: e.target.value})} required/>
                  <button type="submit" className="btn-primary" style={{width: '100%'}}>Зарегистрировать</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}