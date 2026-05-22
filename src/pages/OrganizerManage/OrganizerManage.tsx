import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Participant, Match, AppUser, Tournament } from '../../types'
import { useToast } from '../../components/ToastContext'
import './OrganizerManage.css'

export default function OrganizerManage() {
  const { id } = useParams()
  const { showToast } = useToast()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  
  const [tab, setTab] = useState<'participants' | 'matches' | 'standings' | 'settings'>('participants')
  const [activeRound, setActiveRound] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(true)
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [foundPlayers, setFoundPlayers] = useState<AppUser[]>([])
  const [newPlayer, setNewPlayer] = useState({ full_name: '', email: '', age: '', rating: '' })
  const [generatedCredentials, setGeneratedCredentials] = useState<{email: string, password: string} | null>(null)

  useEffect(() => { if(id) fetchData() }, [id])

  const fetchData = async () => {
    setIsLoading(true)
    const { data: tData } = await supabase.from('tournaments').select('*').eq('id', id).single()
    const { data: pData } = await supabase.from('participants').select('*, app_users(full_name, rating)').eq('tournament_id', id)
    const { data: mData } = await supabase.from('matches').select('*').eq('tournament_id', id)
    
    if (tData) setTournament(tData)
    setParticipants(pData || [])
    
    if (mData && mData.length > 0) {
      setMatches(mData)
      const maxR = Math.max(...mData.map((m: Match) => m.round_number))
      setActiveRound(maxR)
    } else {
      setMatches([])
    }
    setIsLoading(false)
  }

  // Проверка лимита мест
  const hasAvailableSpots = () => {
    if (!tournament) return false
    const confirmedCount = participants.filter(p => p.status === 'confirmed').length
    if (confirmedCount >= tournament.total_spots) {
      showToast(`Достигнут лимит участников: ${tournament.total_spots} чел. Увеличьте лимит в настройках.`, 'error')
      return false
    }
    return true
  }

  // --- Настройки ---
  const handleUpdateSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const updates = {
      title: formData.get('title'),
      time_control: formData.get('time_control'),
      total_rounds: parseInt(formData.get('total_rounds') as string),
      total_spots: parseInt(formData.get('total_spots') as string),
      start_datetime: formData.get('start_datetime'),
      end_datetime: formData.get('end_datetime')
    }

    const { error } = await supabase.from('tournaments').update(updates).eq('id', id)

    if (error) {
      showToast('Ошибка при сохранении: ' + error.message, 'error')
    } else {
      showToast('Настройки успешно обновлены!')
      fetchData()
    }
  }

  // --- Жеребьевка ---
  const getStandings = () => {
    const scores: Record<string, { id: string, name: string, points: number, rating: number }> = {}
    
    participants.filter(p => p.status === 'confirmed').forEach(p => {
      scores[p.player_id] = { 
        id: p.player_id,
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

  const generateRound = async () => {
    if (!tournament) return
    const standings = getStandings()
    
    if (standings.length < 2) {
      showToast('Недостаточно подтвержденных участников (минимум 2)', 'error')
      return
    }

    const nextRound = currentRound + 1
    const newMatches = []
    let table = 1

    let pairingPool = [...standings]
    let byePlayer = null

    if (pairingPool.length % 2 !== 0) {
      const pastByes = matches.filter(m => m.player_black_id === null).map(m => m.player_white_id)
      let byeIndex = -1
      for (let i = pairingPool.length - 1; i >= 0; i--) {
        if (!pastByes.includes(pairingPool[i].id)) {
          byeIndex = i
          break
        }
      }
      if (byeIndex === -1) byeIndex = pairingPool.length - 1

      byePlayer = pairingPool[byeIndex]
      pairingPool.splice(byeIndex, 1)
    }

    for (let i = 0; i < pairingPool.length; i += 2) {
      newMatches.push({
        tournament_id: id, 
        round_number: nextRound, 
        table_number: table++,
        player_white_id: pairingPool[i].id, 
        player_black_id: pairingPool[i + 1].id,
        result: null
      })
    }

    if (byePlayer) {
      newMatches.push({
        tournament_id: id, 
        round_number: nextRound, 
        table_number: table,
        player_white_id: byePlayer.id, 
        player_black_id: null, 
        result: '1-0'
      })
    }
    
    const { error } = await supabase.from('matches').insert(newMatches)
    if (error) {
      showToast('Ошибка генерации: ' + error.message, 'error')
      return
    }

    setActiveRound(nextRound)
    fetchData()
  }

  const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round_number)) : 0
  const matchesOfCurrentRound = matches.filter(m => m.round_number === currentRound)
  const allResultsEntered = matchesOfCurrentRound.length > 0 && matchesOfCurrentRound.every(m => m.result && m.result !== '')
  const isTournamentFinished = tournament && currentRound === tournament.total_rounds && allResultsEntered

  // --- Управление игроками ---
  
  const confirmPlayer = async (pId: string) => {
    if (!hasAvailableSpots()) return
    await supabase.from('participants').update({ status: 'confirmed' }).eq('id', pId)
    showToast('Заявка принята')
    fetchData()
  }

  // НОВАЯ ФУНКЦИЯ: Принять всех
  const approveAllPlayers = async () => {
    if (!tournament) return
    const pendingPlayers = participants.filter(p => p.status === 'pending')
    const confirmedCount = participants.filter(p => p.status === 'confirmed').length
    
    if (confirmedCount + pendingPlayers.length > tournament.total_spots) {
      showToast(`Ошибка: Мест (${tournament.total_spots - confirmedCount}) меньше, чем заявок (${pendingPlayers.length})`, 'error')
      return
    }

    const { error } = await supabase.from('participants').update({ status: 'confirmed' }).eq('tournament_id', id).eq('status', 'pending')
    
    if (error) {
      showToast('Ошибка при массовом принятии', 'error')
    } else {
      showToast(`Успешно принято: ${pendingPlayers.length} чел.`)
      fetchData()
    }
  }

  const removePlayer = async (pId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить участника?')) {
      await supabase.from('participants').delete().eq('id', pId)
      showToast('Участник удален')
      fetchData()
    }
  }

  const handleSearch = async () => {
    const { data } = await supabase.from('app_users').select('*').eq('role', 'player').ilike('full_name', `%${searchQuery}%`)
    setFoundPlayers(data || [])
  }

  const addExistingPlayer = async (playerId: string) => {
    if (!hasAvailableSpots()) return
    const { error } = await supabase.from('participants').insert([{ tournament_id: id, player_id: playerId, status: 'confirmed' }])
    if (error) {
      showToast('Игрок уже в турнире', 'error')
    } else { 
      showToast('Игрок добавлен')
      fetchData()
      closeModal() 
    }
  }

  const generatePassword = () => Math.random().toString(36).slice(-8)

  const handleCreateNewPlayer = async (e: FormEvent) => {
    e.preventDefault()
    if (!hasAvailableSpots()) return

    const password = generatePassword()
    const { data: user, error: userError } = await supabase.from('app_users').insert([{
      email: newPlayer.email, password: password, role: 'player',
      full_name: newPlayer.full_name, age: parseInt(newPlayer.age), rating: parseInt(newPlayer.rating)
    }]).select().single()

    if (userError) { 
      showToast('Ошибка: возможно email уже занят', 'error')
      return 
    }
    
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

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return 'Пропуск тура (Bye)'
    const p = participants.find(part => part.player_id === playerId)
    return p?.app_users?.full_name || 'Неизвестный игрок'
  }

  const closeModal = () => {
    setShowAddModal(false); setGeneratedCredentials(null); setSearchQuery(''); setFoundPlayers([])
  }

  if (isLoading) return <div className="container"><div className="loader-container"><div className="spinner"></div></div></div>
  if (!tournament) return <div className="container">Ошибка загрузки турнира</div>

  return (
    <div className="container">
      <div className="tabs">
        <button className={`tab-btn ${tab === 'participants' ? 'active' : ''}`} onClick={() => setTab('participants')}>Участники</button>
        <button className={`tab-btn ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Жеребьевка</button>
        <button className={`tab-btn ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Итоговая таблица</button>
        <button className={`tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Настройки</button>
      </div>

      {tab === 'participants' && (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{color: '#660000'}}>Управление участниками</h2>
            <div style={{display: 'flex', gap: '10px'}}>
              {currentRound === 0 && participants.some(p => p.status === 'pending') && (
                 <button className="btn-success" onClick={approveAllPlayers}>Принять всех</button>
              )}
              {currentRound === 0 && (
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Добавить участника</button>
              )}
            </div>
          </div>
          
          {currentRound > 0 && <p style={{color: '#660000', marginTop: 10, fontWeight: 'bold'}}>* Регистрация закрыта, так как турнир уже начался.</p>}

          <div className="participant-list">
            {participants.length === 0 ? (
              <p style={{ marginTop: '10px' }}>Участников пока нет.</p>
            ) : (
              participants.map(p => (
                <div key={p.id} className="participant-row">
                  <div className="participant-info">
                    <span className="participant-name">{p.app_users?.full_name}</span>
                    <span className="participant-rating">Рейтинг ФИДЕ/ФШР: <strong>{p.app_users?.rating}</strong></span>
                  </div>
                  <div className="participant-controls">
                    <span className={`badge ${p.status === 'pending' ? 'bg-pending' : 'bg-confirmed'}`}>
                      {p.status === 'pending' ? 'Ожидает' : 'Принят'}
                    </span>
                    <div className="actions-cell">
                      {p.status === 'pending' && currentRound === 0 && <button className="btn-success" onClick={() => confirmPlayer(p.id)}>Принять</button>}
                      {currentRound === 0 && <button className="btn-danger" onClick={() => removePlayer(p.id)}>{p.status === 'pending' ? 'Отклонить' : 'Удалить'}</button>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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

          {currentRound > 0 && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[...Array(currentRound)].map((_, i) => {
                const r = i + 1;
                const isActive = activeRound === r;
                return (
                  <button 
                    key={r}
                    onClick={() => setActiveRound(r)}
                    style={{
                      padding: '8px 16px', border: isActive ? 'none' : '1px solid #ccc',
                      backgroundColor: isActive ? '#660000' : '#FFFFFF', color: isActive ? '#FFFFFF' : '#000000',
                      borderRadius: '4px', cursor: 'pointer', fontWeight: isActive ? 'bold' : 'normal'
                    }}
                  >
                    Тур {r}
                  </button>
                )
              })}
            </div>
          )}

          {currentRound > 0 && (
            <div style={{marginBottom: 30}}>
              <h3 style={{color: '#660000', marginBottom: 10}}>Результаты: Тур {activeRound}</h3>
              <table>
                <thead><tr><th>Стол</th><th>Белые</th><th>Черные</th><th>Счет</th></tr></thead>
                <tbody>
                  {matches.filter(m => m.round_number === activeRound).sort((a,b) => a.table_number - b.table_number).map(m => (
                    <tr key={m.id}>
                      <td width="50">{m.table_number}</td>
                      <td width="35%">{getPlayerName(m.player_white_id)}</td>
                      <td width="35%">{getPlayerName(m.player_black_id)}</td>
                      <td>
                        <select 
                          value={m.result || ''} 
                          onChange={(e) => updateResult(m.id, e.target.value)}
                          disabled={activeRound !== currentRound || !m.player_black_id}
                          title={activeRound !== currentRound ? "Редактирование доступно только для текущего тура" : ""}
                        >
                          <option value="">Ожидается...</option>
                          <option value="1-0">1-0 (Победа белых)</option>
                          <option value="0-1">0-1 (Победа черных)</option>
                          <option value="0.5-0.5">Ничья</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'standings' && (
        <div>
          <h2 style={{color: '#660000', marginBottom: 15}}>{isTournamentFinished ? 'Финальная таблица' : 'Текущее положение (Live)'}</h2>
          <table>
            <thead><tr><th>Место</th><th>ФИО</th><th>Рейтинг</th><th>Очки</th></tr></thead>
            <tbody>
              {getStandings().map((p, index) => (
                <tr key={p.name}>
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

      {tab === 'settings' && tournament && (
        <div>
          <h2 style={{color: '#660000', marginBottom: '20px'}}>Настройки турнира</h2>
          <form onSubmit={handleUpdateSettings} style={{maxWidth: '500px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px'}}>
            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Название турнира</label>
            <input name="title" defaultValue={tournament.title} required />

            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Дата и время начала</label>
            <input name="start_datetime" type="datetime-local" defaultValue={tournament.start_datetime.slice(0, 16)} required />

            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Дата и время окончания</label>
            <input name="end_datetime" type="datetime-local" defaultValue={tournament.end_datetime.slice(0, 16)} required />

            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Формат турнира</label>
            <select name="time_control" defaultValue={tournament.time_control} required>
              <option value="блиц">Блиц</option>
              <option value="рапид">Рапид</option>
              <option value="классика">Классика</option>
            </select>

            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Лимит участников</label>
            <input name="total_spots" type="number" defaultValue={tournament.total_spots} min={participants.filter(p => p.status === 'confirmed').length} required />

            <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Количество туров</label>
            <input name="total_rounds" type="number" defaultValue={tournament.total_rounds} min={Math.max(1, currentRound)} required />

            <button type="submit" className="btn-primary" style={{marginTop: '10px', width: '100%'}}>Сохранить изменения</button>
          </form>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 20}}>
              <h3 style={{color: '#660000'}}>Добавить участника</h3>
              <button onClick={closeModal} style={{background: 'none', border: 'none', fontSize: 20, cursor: 'pointer'}}>×</button>
            </div>
            {generatedCredentials ? (
              <div style={{backgroundColor: '#e6ffe6', padding: '15px', borderRadius: '4px', marginBottom: '20px', border: '1px solid #2e8b57'}}>
                <h4 style={{color: '#2e8b57', marginBottom: '10px'}}>Игрок успешно зарегистрирован!</h4>
                <p><strong>Логин:</strong> {generatedCredentials.email}</p>
                <p><strong>Пароль:</strong> {generatedCredentials.password}</p>
                <button className="btn-primary" style={{marginTop: '15px', width: '100%'}} onClick={() => setGeneratedCredentials(null)}>Зарегистрировать еще</button>
              </div>
            ) : (
              <>
                <div className="search-box">
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по ФИО..." style={{marginBottom: 0}}/>
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
                  <input placeholder="ФИО" value={newPlayer.full_name} onChange={e => setNewPlayer({...newPlayer, full_name: e.target.value})} required minLength={3}/>
                  <input type="email" placeholder="Email (логин)" value={newPlayer.email} onChange={e => setNewPlayer({...newPlayer, email: e.target.value})} required/>
                  <input type="number" placeholder="Возраст (5-100)" value={newPlayer.age} onChange={e => setNewPlayer({...newPlayer, age: e.target.value})} required min="5" max="100"/>
                  <input type="number" placeholder="Рейтинг (0-3000)" value={newPlayer.rating} onChange={e => setNewPlayer({...newPlayer, rating: e.target.value})} required min="0" max="3000"/>
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