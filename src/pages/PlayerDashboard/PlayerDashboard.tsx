import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'
import { useToast } from '../../components/ToastContext'
import './PlayerDashboard.css'

export default function PlayerDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { showToast } = useToast()
  
  // Состояния фильтров
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    setIsLoading(true)
    const userString = localStorage.getItem('user')
    if (!userString) return
    const user: AppUser = JSON.parse(userString)

    // 1. Получаем все турниры
    const { data: tData } = await supabase.from('tournaments').select('*')
    
    // 2. Получаем всех ПОДТВЕРЖДЕННЫХ участников для подсчета свободных мест
    const { data: pData } = await supabase.from('participants').select('tournament_id').eq('status', 'confirmed')
    
    // 3. Получаем заявки ТЕКУЩЕГО ИГРОКА, чтобы заблокировать кнопку и иметь ID для отзыва
    const { data: myApps } = await supabase.from('participants').select('id, tournament_id').eq('player_id', user.id)

    if (tData) {
      // Считаем занятые места
      const counts: Record<string, number> = {}
      if (pData) {
        pData.forEach(p => {
          counts[p.tournament_id] = (counts[p.tournament_id] || 0) + 1
        })
      }

      // Создаем Map (ID турнира -> ID заявки), чтобы знать, на что мы подали заявку
      const appliedMap = new Map(myApps?.map(a => [a.tournament_id, a.id]) || [])

      // Обогащаем турниры новыми полями
      const enrichedTournaments = tData.map(t => ({
        ...t,
        confirmed_count: counts[t.id] || 0,
        has_applied: appliedMap.has(t.id),
        participant_id: appliedMap.get(t.id) // ID нашей заявки для возможности её удалить
      }))
      
      setTournaments(enrichedTournaments)
    }
    setIsLoading(false)
  }

  const handleApply = async (tId: string) => {
    const userString = localStorage.getItem('user')
    if (!userString) return
    const user: AppUser = JSON.parse(userString)

    const { error } = await supabase.from('participants').insert([{ tournament_id: tId, player_id: user.id }])
    
    if (error) {
      showToast('Ошибка при подаче заявки!', 'error')
    } else {
      showToast('Заявка успешно отправлена организатору!')
      fetchTournaments() // Обновляем список
    }
  }

  // --- НОВАЯ ФУНКЦИЯ: Отозвать заявку ---
  const handleWithdraw = async (participantId: string | undefined) => {
    if (!participantId) return
    
    const { error } = await supabase.from('participants').delete().eq('id', participantId)
    
    if (error) {
      showToast('Ошибка при отмене заявки', 'error')
    } else {
      showToast('Ваша заявка отозвана')
      fetchTournaments() // Обновляем список
    }
  }

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const filteredTournaments = tournaments.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCity = filterCity === '' || t.city === filterCity
    const matchFormat = filterFormat === '' || t.time_control === filterFormat
    const matchDate = filterDate === '' || new Date(t.start_datetime) >= new Date(filterDate)

    return matchSearch && matchCity && matchFormat && matchDate
  })

  const uniqueCities = Array.from(new Set(tournaments.map(t => t.city)))

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', { 
      dateStyle: 'short', 
      timeStyle: 'short' 
    })
  }

  if (isLoading) {
    return <div className="container"><div className="loader-container"><div className="spinner"></div></div></div>
  }

  return (
    <div className="container">
      <h2 style={{color: '#660000'}}>Поиск турниров</h2>
      
      {/* ПАНЕЛЬ ФИЛЬТРОВ */}
      <div className="filters-container">
        <input 
          type="text" 
          placeholder="Поиск по названию..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{flex: '2'}}
        />
        
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
          <option value="">Все города</option>
          {uniqueCities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <select value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)}>
          <option value="">Любой формат</option>
          <option value="блиц">Блиц</option>
          <option value="рапид">Рапид</option>
          <option value="классика">Классика</option>
        </select>

        <input 
          type="date" 
          title="Начиная с даты" 
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
      </div>

      {/* КАРТОЧКИ ТУРНИРОВ */}
      {filteredTournaments.length === 0 ? (
        <p>По вашему запросу ничего не найдено.</p>
      ) : (
        <div className="grid">
          {filteredTournaments.map(t => {
            const availableSpots = t.total_spots - (t.confirmed_count || 0)
            const tournamentStarted = new Date() > new Date(t.start_datetime) // Проверка: начался ли турнир

            return (
              <div key={t.id} className="card">
                <h3>{t.title}</h3>
                <p><strong>Город:</strong> {t.city}</p>
                <p><strong>Формат:</strong> {t.time_control}</p>
                <p><strong>Начало:</strong> {formatDate(t.start_datetime)}</p>
                <p><strong>Окончание:</strong> {formatDate(t.end_datetime)}</p>
                
                <p>
                  <strong>Свободных мест:</strong>{' '}
                  <span style={{ color: availableSpots > 0 ? '#2e8b57' : '#cc0000', fontWeight: 'bold' }}>
                    {availableSpots > 0 ? `${availableSpots} из ${t.total_spots}` : 'Мест нет'}
                  </span>
                </p>

                <div className="card-actions">
                  {t.has_applied ? (
                    // Если заявка подана и турнир еще не начался, даем возможность её отозвать
                    !tournamentStarted ? (
                      <button 
                        className="btn-primary" 
                        style={{backgroundColor: '#cc0000'}} 
                        onClick={() => handleWithdraw(t.participant_id)}
                      >
                        Отозвать заявку
                      </button>
                    ) : (
                       // Если турнир уже идет, просто показываем бейдж
                       <button className="btn-primary" disabled style={{backgroundColor: '#2e8b57', opacity: 0.8}}>
                         В турнире
                       </button>
                    )
                  ) : (
                    // Если заявка не подана
                    <button 
                      className="btn-primary" 
                      onClick={() => handleApply(t.id)}
                      disabled={availableSpots <= 0}
                      style={{ opacity: availableSpots <= 0 ? 0.5 : 1, cursor: availableSpots <= 0 ? 'not-allowed' : 'pointer' }}
                    >
                      Подать заявку
                    </button>
                  )}
                  
                  <button 
                    className="btn-primary" 
                    style={{backgroundColor: '#000'}} 
                    onClick={() => navigate(`/tournaments/${t.id}`)}
                  >
                    Сетка
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}