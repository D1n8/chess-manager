import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'
import './PlayerDashboard.css'

export default function PlayerDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  // Состояния фильтров
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const navigate = useNavigate()

  const fetchTournaments = async () => {
    // 1. Получаем все турниры
    const { data: tData } = await supabase.from('tournaments').select('*')
    // 2. Получаем всех ПОДТВЕРЖДЕННЫХ участников для подсчета мест
    const { data: pData } = await supabase.from('participants').select('tournament_id').eq('status', 'confirmed')

    if (tData) {
      // Считаем занятые места по каждому турниру
      const counts: Record<string, number> = {}
      if (pData) {
        pData.forEach(p => {
          counts[p.tournament_id] = (counts[p.tournament_id] || 0) + 1
        })
      }

      // Обогащаем турниры полем confirmed_count
      const enrichedTournaments = tData.map(t => ({
        ...t,
        confirmed_count: counts[t.id] || 0
      }))

      setTournaments(enrichedTournaments)
    }
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  const handleApply = async (tId: string, availableSpots: number) => {
    if (availableSpots <= 0) {
      alert('К сожалению, свободных мест больше нет.')
      return
    }

    const userString = localStorage.getItem('user')
    if (!userString) return
    const user: AppUser = JSON.parse(userString)

    const { error } = await supabase.from('participants').insert([{ tournament_id: tId, player_id: user.id }])

    if (error) {
      alert('Вы уже подали заявку на этот турнир!')
    } else {
      alert('Заявка успешно отправлена организатору!')
      fetchTournaments() // Обновляем места
    }
  }

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const filteredTournaments = tournaments.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCity = filterCity === '' || t.city === filterCity
    const matchFormat = filterFormat === '' || t.time_control === filterFormat

    // Фильтр по дате: показываем турниры, которые начинаются в выбранный день или позже
    const matchDate = filterDate === '' || new Date(t.start_datetime) >= new Date(filterDate)

    return matchSearch && matchCity && matchFormat && matchDate
  })

  // Получаем уникальный список городов для выпадающего списка
  const uniqueCities = Array.from(new Set(tournaments.map(t => t.city)))

  // Вспомогательная функция для красивого вывода даты
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  }

  return (
    <div className="container">
      <h2 style={{ color: '#660000' }}>Поиск турниров</h2>

      {/* ПАНЕЛЬ ФИЛЬТРОВ */}
      <div className="filters-container">
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: '2' }}
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
                  <button
                    className="btn-primary"
                    onClick={() => handleApply(t.id, availableSpots)}
                    disabled={availableSpots <= 0}
                    style={{ opacity: availableSpots <= 0 ? 0.5 : 1, cursor: availableSpots <= 0 ? 'not-allowed' : 'pointer' }}
                  >
                    Подать заявку
                  </button>
                  <button
                    className="btn-primary"
                    style={{ backgroundColor: '#000' }}
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